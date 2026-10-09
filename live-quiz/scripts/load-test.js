#!/usr/bin/env node
// Run against a disposable quiz whose emergency passphrase fallback was explicitly enabled.
const { io } = require("socket.io-client");
const { performance } = require("node:perf_hooks");
const { setTimeout: delay } = require("node:timers/promises");
const { BATCHES } = require("../questions");

const defaults = { players: 120, sustainMs: 30000, timeoutMs: 15000, maxP95Ms: 1000,
  batchId: "batch-1", duration: 20 };
const sockets = new Set();
const report = {
  batchId: null,
  duration: null,
  requestedPlayers: 0,
  joinedPlayers: 0,
  questions: 0,
  answerAcks: 0,
  disconnectedUnexpectedly: 0,
  http5xx: 0,
  errors: 0,
  minimumConnectedPlayers: 0,
  p95AckMs: null,
};
let intentionalShutdown = false;
let configuredLobby = false;
let connectedPlayers = 0;
const latencies = [];

function options() {
  if (process.argv.includes("--help")) {
    console.log("Usage: BASE_URL=https://<app>.azurewebsites.net HOST_PASSPHRASE=<secret> node scripts/load-test.js [--batch batch-1] [--duration 20] [--players 120] [--sustain-ms 30000] [--timeout-ms 15000] [--max-p95-ms 1000]");
    console.log("This runs a real, destructive 12-question quiz. Use an idle, disposable game with the emergency passphrase fallback explicitly enabled.");
    process.exit(0);
  }
  const opts = { ...defaults };
  const names = { "--players": "players", "--sustain-ms": "sustainMs", "--timeout-ms": "timeoutMs",
    "--max-p95-ms": "maxP95Ms", "--batch": "batchId", "--duration": "duration" };
  for (let i = 2; i < process.argv.length; i++) {
    const [flag, inline] = process.argv[i].split("=", 2);
    if (!Object.hasOwn(names, flag)) throw new Error(`Unknown option ${flag}`);
    const raw = inline === undefined ? process.argv[++i] : inline;
    if (flag === "--batch") {
      if (!Object.hasOwn(BATCHES, raw || "")) throw new Error("Choose batch-1 through batch-4");
      opts.batchId = raw;
      continue;
    }
    if (!/^\d+$/.test(raw || "")) throw new Error(`${flag} must be a positive integer`);
    opts[names[flag]] = Number(raw);
    if (!Number.isSafeInteger(opts[names[flag]])) throw new Error(`${flag} exceeds the safe integer range`);
  }
  if (opts.players < 100 || opts.sustainMs < 1000 || opts.timeoutMs < 1000 || opts.maxP95Ms < 1
    || opts.duration < 10 || opts.duration > 120) {
    throw new Error("Require at least 100 players, 1000ms sustain and timeout, 10-120s duration and positive p95 limit");
  }
  const secret = process.env.HOST_PASSPHRASE;
  const rawUrl = process.env.BASE_URL;
  if (!secret || !rawUrl) throw new Error("Set BASE_URL and HOST_PASSPHRASE; the target app must explicitly enable the emergency fallback");
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment");
  }
  return { ...opts, baseUrl: url.origin, secret };
}

function waitFor(socket, name, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, received);
      reject(new Error(`${name} event timed out`));
    }, timeoutMs);
    function received(data) {
      clearTimeout(timer);
      resolve(data);
    }
    socket.once(name, received);
  });
}

function acknowledged(socket, name, args, timeoutMs) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(name, ...args, (error, response) => {
      if (error) return reject(new Error(`${name} acknowledgement timed out`));
      latencies.push(performance.now() - started);
      resolve(response);
    });
  });
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function assertConnected() {
  const count = [...sockets].filter((socket) => socket.connected && socket !== hostSocket).length;
  report.minimumConnectedPlayers = Math.min(report.minimumConnectedPlayers, count);
  check(count === report.requestedPlayers,
    `Only ${count} of ${report.requestedPlayers} requested players remain connected`);
  check(report.disconnectedUnexpectedly === 0, "Unexpected socket disconnection");
  check(hostSocket?.connected, "Host socket disconnected");
}

let hostSocket;
async function openSocket(baseUrl, timeoutMs, player = false) {
  const socket = io(baseUrl, {
    autoConnect: false,
    reconnection: false,
    transports: ["websocket"],
    timeout: timeoutMs,
  });
  sockets.add(socket);
  socket.on("disconnect", () => {
    if (!intentionalShutdown) report.disconnectedUnexpectedly++;
    if (player && socket.__joined) connectedPlayers--;
  });
  const connected = waitFor(socket, "connect", timeoutMs);
  socket.connect();
  await connected;
  return socket;
}

async function probe(url, timeoutMs) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (response.status >= 500) report.http5xx++;
  check(response.ok, `HTTP ${response.status} from ${new URL(url).pathname}`);
  return response;
}

async function run(config) {
  const { players, sustainMs, timeoutMs, maxP95Ms, baseUrl, secret, batchId, duration } = config;
  const questions = BATCHES[batchId].questions;
  report.requestedPlayers = players;
  report.batchId = batchId;
  report.duration = duration;
  console.log(`Running ${players} WebSocket players, ${batchId} (${questions.length} questions, ${duration}s), and ${sustainMs}ms sustained against ${baseUrl}`);
  await probe(`${baseUrl}/healthz`, timeoutMs);
  hostSocket = await openSocket(baseUrl, timeoutMs);
  const initialLobby = waitFor(hostSocket, "lobby", timeoutMs);
  const authorization = await acknowledged(hostSocket, "host:join", [{ type: "passphrase", passphrase: secret }], timeoutMs);
  check(authorization?.ok === true, "Host authentication failed");
  check(authorization.phase === "lobby", "The hosted game is not idle; restart it separately before running the load test");
  const sessionId = authorization.sessionId;
  const qr = await (await probe(`${baseUrl}/qr?session=${encodeURIComponent(sessionId)}`, timeoutMs)).json();
  check(qr.url === `${baseUrl}/play?session=${sessionId}`, "QR join URL does not match the host session");
  check(typeof qr.dataUrl === "string" && qr.dataUrl.startsWith("data:image/png;base64,"), "QR image is missing");
  const lobby = await initialLobby;
  check(lobby.batchId === null && lobby.duration === 20, "Idle lobby must require a fresh batch and 20s default");
  check((await acknowledged(hostSocket, "host:select-batch", [batchId], timeoutMs))?.ok === true,
    "Could not select the requested batch");
  configuredLobby = true;
  check((await acknowledged(hostSocket, "host:set-duration", [duration], timeoutMs))?.ok === true,
    "Could not set requested duration");

  const clients = await Promise.all(Array.from({ length: players }, async (_, index) => {
    const socket = await openSocket(baseUrl, timeoutMs, true);
    const name = `Load-${String(index + 1).padStart(4, "0")}`;
    const joined = await acknowledged(socket, "player:join", [{ sessionId, name }], timeoutMs);
    check(joined?.ok === true && joined.name === name, `Player ${index + 1} could not join`);
    socket.__joined = true;
    connectedPlayers++;
    report.joinedPlayers++;
    return { socket, name, score: 0, index };
  }));
  check(report.joinedPlayers === players, "Some players were not admitted");
  report.minimumConnectedPlayers = connectedPlayers;
  assertConnected();
  const deadline = performance.now() + sustainMs;
  let nextProbe = performance.now() + 5000;
  while (performance.now() < deadline) {
    await delay(Math.min(250, Math.max(1, deadline - performance.now())));
    assertConnected();
    if (performance.now() >= nextProbe) {
      await probe(`${baseUrl}/healthz`, timeoutMs);
      nextProbe = performance.now() + 5000;
    }
  }

  for (let number = 0; number < questions.length; number++) {
    const hostQuestion = waitFor(hostSocket, "question", timeoutMs);
    const playerQuestions = clients.map(({ socket }) => waitFor(socket, "question", timeoutMs));
    if (number === 0) hostSocket.emit("host:start");
    else hostSocket.emit("host:next");
    const question = await hostQuestion;
    check(question.index === number && question.total === questions.length &&
          question.q === questions[number].q &&
          JSON.stringify(question.o) === JSON.stringify(questions[number].o),
      `Unexpected host question ${number + 1}`);
    check(question.duration === duration && question.remainingMs > 0 &&
          question.remainingMs <= duration * 1000, "Incorrect question timer payload");
    const publiclyVisible = await Promise.all(playerQuestions);
    check(publiclyVisible.every((q) => q.index === number && q.count === 4 && q.o === undefined &&
          q.duration === duration && q.remainingMs > 0 && q.remainingMs <= duration * 1000),
      `Question ${number + 1} leaked host-only options or missed a player`);

    const hostReveal = waitFor(hostSocket, "reveal", timeoutMs);
    const feedback = clients.map(({ socket }) => waitFor(socket, "reveal", timeoutMs));
    const selected = clients.map((client) =>
      client.index % 2 === 0 ? questions[number].c : (questions[number].c + 1) % 4);
    const answers = await Promise.all(clients.map(({ socket }, index) =>
      acknowledged(socket, "player:answer", [selected[index]], timeoutMs)));
    answers.forEach((answer, index) => {
      check(answer?.ok === true && answer.correct === (index % 2 === 0),
        `Question ${number + 1}: invalid answer acknowledgement for player ${index + 1}`);
      check(Number.isFinite(answer.gained) && answer.gained >= 0,
        `Question ${number + 1}: invalid points for player ${index + 1}`);
      clients[index].score += answer.gained;
      report.answerAcks++;
    });
    const reveal = await hostReveal;
    check(reveal.correct === questions[number].c, `Question ${number + 1}: unexpected correct answer`);
    check(reveal.dist.reduce((sum, value) => sum + value, 0) === players &&
          reveal.dist[questions[number].c] === Math.ceil(players / 2),
    `Question ${number + 1}: answer distribution is incorrect`);
    const playerResults = await Promise.all(feedback);
    playerResults.forEach((result, index) => {
      check(result.correct === (index % 2 === 0) && result.score === clients[index].score &&
            result.total === players && result.rank >= 1 && result.rank <= players,
      `Question ${number + 1}: incorrect reveal for player ${index + 1}`);
    });
    check(reveal.last === (number === questions.length - 1), "Incorrect final-question marker");
    report.questions++;
    assertConnected();
    await probe(`${baseUrl}/healthz`, timeoutMs);
  }

  const hostEnd = waitFor(hostSocket, "end", timeoutMs);
  const playerEnds = clients.map(({ socket }) => waitFor(socket, "end", timeoutMs));
  hostSocket.emit("host:next");
  const final = await hostEnd;
  check(final.podium.length === 3 && final.leaderboard.length === 10, "Incomplete final leaderboard");
  (await Promise.all(playerEnds)).forEach((result, index) => {
    check(result.name === clients[index].name && result.total === players &&
          result.rank >= 1 && result.rank <= players && result.score === clients[index].score,
    `Incorrect final result for player ${index + 1}`);
  });
  assertConnected();
  await probe(`${baseUrl}/healthz`, timeoutMs);

  const sorted = [...latencies].sort((a, b) => a - b);
  report.p95AckMs = Math.round(sorted[Math.ceil(sorted.length * .95) - 1] * 100) / 100;
  check(report.answerAcks === players * questions.length, "Not all answers were acknowledged");
  check(report.p95AckMs <= maxP95Ms, `p95 acknowledgement ${report.p95AckMs}ms exceeds ${maxP95Ms}ms`);
  check(report.disconnectedUnexpectedly === 0 && report.http5xx === 0, "Disconnects or HTTP 5xx occurred");
}

async function main() {
  let secret;
  let config;
  try {
    config = options();
    secret = config.secret;
    await run(config);
  } catch (error) {
    report.errors++;
    console.error(`FAIL: ${String(error.message || error).replaceAll(secret || "\u0000", "[redacted]")}`);
    process.exitCode = 1;
  } finally {
    if (configuredLobby) {
      try {
        let resetSocket = hostSocket;
        if (!resetSocket?.connected) {
          resetSocket = await openSocket(config.baseUrl, config.timeoutMs);
          const auth = await acknowledged(resetSocket, "host:join", [{ type: "passphrase", passphrase: config.secret }], config.timeoutMs);
          check(auth?.ok === true, "Could not reauthenticate host to reset the game");
        }
        const reset = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resetSocket.off("lobby", received);
            reject(new Error("Timed out waiting for an unselected 20-second lobby"));
          }, config.timeoutMs);
          function received(state) {
            if (state.phase !== "lobby" || state.batchId !== null || state.duration !== 20) return;
            clearTimeout(timer);
            resetSocket.off("lobby", received);
            resolve();
          }
          resetSocket.on("lobby", received);
        });
        resetSocket.emit("host:restart");
        await reset;
      } catch (error) {
        report.errors++;
        console.error(`FAIL: Could not reset the load-test game: ${error.message}`);
        process.exitCode = 1;
      }
    }
    intentionalShutdown = true;
    for (const socket of sockets) socket.disconnect();
    console.log(JSON.stringify(report, null, 2));
  }
}

main();
