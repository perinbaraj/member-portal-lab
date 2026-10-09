const { after, afterEach, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { io } = require("socket.io-client");
const { BATCHES } = require("../questions");

const root = path.resolve(__dirname, "..");
const passphrase = "Integration-Host-Quiz-2026!";
const adminPassphrase = "Admin-Integration-Quiz-2026!";
let child;
let baseUrl;
let output = "";
const sockets = new Set();

async function availablePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function event(socket, name, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, received);
      reject(new Error(`Timed out waiting for ${name}`));
    }, timeout);
    function received(value) {
      clearTimeout(timer);
      resolve(value);
    }
    socket.once(name, received);
  });
}

function ack(socket, name, ...args) {
  return new Promise((resolve, reject) => {
    socket.timeout(3000).emit(name, ...args, (error, result) => {
      if (error) reject(new Error(`${name} acknowledgement timed out`));
      else resolve(result);
    });
  });
}

async function adminLogin(operatorName = "Integration Operator") {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operatorName, passphrase: adminPassphrase }),
  });
  assert.equal(response.status, 200);
  const session = await response.json();
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /live_quiz_admin=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  return { ...session, cookie: cookie.split(";")[0] };
}

function adminFetch(pathname, session, options = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      cookie: session.cookie,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(!["GET", "HEAD"].includes((options.method || "GET").toUpperCase())
        ? { "x-admin-csrf": session.csrfToken } : {}),
      ...(options.headers || {}),
    },
  });
}

async function connect(sessionId = null) {
  const socket = io(baseUrl, {
    autoConnect: false,
    reconnection: false,
    transports: ["websocket"],
    timeout: 3000,
  });
  sockets.add(socket);
  const connected = event(socket, "connect");
  socket.connect();
  await connected;
  socket.sessionId = sessionId;
  if (sessionId) {
    const inspected = await ack(socket, "session:inspect", sessionId);
    assert.equal(inspected.ok, true);
    socket.initialBrand = Promise.resolve({ brand: inspected.brand });
  }
  return socket;
}
function joinPlayer(socket, name) {
  return ack(socket, "player:join", { sessionId: socket.sessionId, name });
}
function resumePlayer(socket, token) {
  return ack(socket, "player:resume", { sessionId: socket.sessionId, token });
}

async function host(batchId = "batch-1") {
  const socket = await connect();
  const lobby = event(socket, "lobby");
  const authorization = await ack(socket, "host:join", { type: "passphrase", passphrase });
  assert.equal(authorization.ok, true);
  assert.equal(authorization.phase, "lobby");
  socket.sessionId = authorization.sessionId;
  socket.hostResumeToken = authorization.resumeToken;
  socket.isTestHost = true;
  const state = await lobby;
  assert.equal(state.duration, 20);
  assert.equal(state.batchId, null);
  if (state.brand !== "github") {
    assert.equal((await ack(socket, "host:select-brand", "github")).ok, true);
  }
  if (batchId) assert.equal((await ack(socket, "host:select-batch", batchId)).ok, true);
  return socket;
}
async function otpHost(email, batchId = null) {
  const socket = await connect();
  const requested = await ack(socket, "host:request-otp", email);
  assert.equal(requested.ok, true);
  const lobby = event(socket, "lobby");
  const authorization = await ack(socket, "host:join", {
    type: "otp",
    challengeId: requested.challengeId,
    otp: requested.testOtp,
  });
  assert.equal(authorization.ok, true);
  socket.sessionId = authorization.sessionId;
  socket.hostResumeToken = authorization.resumeToken;
  socket.isTestHost = true;
  await lobby;
  if (batchId) assert.equal((await ack(socket, "host:select-batch", batchId)).ok, true);
  return socket;
}

before(async () => {
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      PUBLIC_BASE_URL: baseUrl,
      HOST_PASSPHRASE: passphrase,
      ALLOW_LEGACY_HOST_PASSPHRASE: "1",
      HOST_EMAIL_MODE: "capture",
      HOST_OTP_TTL_SECONDS: "1",
      HOST_OTP_RESEND_SECONDS: "0",
      HOST_OTP_EMAIL_REQUEST_LIMIT: "3",
      HOST_OTP_IP_REQUEST_LIMIT: "100",
      FEEDBACK_RATE_LIMIT: "2",
      ADMIN_PASSPHRASE: adminPassphrase,
      ADMIN_LOGIN_ATTEMPT_LIMIT: "10",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(400) });
      if (response.ok) return;
    } catch { /* The child is still starting. */ }
    await delay(50);
  }
  throw new Error(`Server failed to start or /healthz was not healthy: ${output.slice(-2000)}`);
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await Promise.race([exited, delay(3000)]);
  }
});

afterEach(async () => {
  const hosts = [...sockets].filter(socket => socket.isTestHost && socket.connected);
  for (const socket of sockets) {
    if (!socket.isTestHost) socket.disconnect();
  }
  if (hosts.length) await delay(25);
  for (const socket of hosts) socket.emit("host:restart");
  if (hosts.length) await delay(25);
  for (const socket of sockets) socket.disconnect();
  sockets.clear();
});

test("health and QR expose the configured public URL, not a local address or secret", async () => {
  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.doesNotMatch(await health.text(), new RegExp(passphrase));

  const realHost = await host(null);
  const qr = await fetch(`${baseUrl}/qr?session=${realHost.sessionId}`);
  assert.equal(qr.status, 200);
  const data = await qr.json();
  assert.equal(data.url, `${baseUrl}/play?session=${realHost.sessionId}`);
  assert.match(data.dataUrl, /^data:image\/png;base64,/);
  assert.doesNotMatch(JSON.stringify(data), new RegExp(passphrase));
  assert.equal((await fetch(`${baseUrl}/play`, { redirect: "manual" })).status, 302);

  const root = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(root.status, 200);
  const rootBody = await root.text();
  assert.match(rootBody, /<section id="authView"/);
  assert.match(rootBody, /id="fullscreenBtn"/);
  assert.doesNotMatch(rootBody, new RegExp(passphrase));

  const shareQr = await fetch(`${baseUrl}/qr?session=${realHost.sessionId}&size=1024`);
  assert.equal(shareQr.status, 200);
  const shareData = await shareQr.json();
  assert.equal(shareData.url, `${baseUrl}/play?session=${realHost.sessionId}`);
  assert.match(shareData.dataUrl, /^data:image\/png;base64,/);
  assert.notEqual(shareData.dataUrl, data.dataUrl);
  for (const size of ["100", "1600", "abc", "-400", "12"]) {
    assert.equal((await fetch(`${baseUrl}/qr?session=${realHost.sessionId}&size=${size}`)).status, 400, `size=${size} should be rejected`);
  }
  assert.equal((await fetch(`${baseUrl}/qr`)).status, 404);
});

test("supports at least 100 concurrent players with stable join and answer flow", { timeout: 30000 }, async () => {
  const hostSocket = await host("batch-1");
  const players = await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    const socket = await connect(hostSocket.sessionId);
    const response = await joinPlayer(socket, `Performance-${index + 1}`);
    assert.equal(response.ok, true);
    assert.equal(response.name, `Performance-${index + 1}`);
    return socket;
  }));

  const hostQuestion = event(hostSocket, "question", 10000);
  const playerQuestions = players.map((socket) => event(socket, "question", 10000));
  hostSocket.emit("host:start");

  const question = await hostQuestion;
  const visibleQuestions = await Promise.all(playerQuestions);
  const expectedAnswer = BATCHES["batch-1"].questions[0].c;
  assert.equal(question.index, 0);
  assert.equal(question.total, BATCHES["batch-1"].questions.length);
  assert.equal(question.duration, 20);
  assert.ok(question.remainingMs > 0 && question.remainingMs <= 20 * 1000);
  assert.equal(players.length, 100);

  visibleQuestions.forEach((payload) => {
    assert.equal(payload.index, 0);
    assert.equal(payload.count, 4);
    assert.equal(payload.duration, 20);
    assert.ok(payload.remainingMs > 0 && payload.remainingMs <= 20 * 1000);
    assert.equal(typeof payload.q, "string");
    assert.equal(payload.o, undefined);
  });

  const hostReveal = event(hostSocket, "reveal", 10000);
  const playerReveal = players.map((socket) => event(socket, "reveal", 10000));
  const answers = await Promise.all(players.map((socket, index) =>
    ack(socket, "player:answer", index % 2 === 0 ? expectedAnswer : (expectedAnswer + 1) % 4)));

  answers.forEach((payload, index) => {
    assert.equal(payload.ok, true);
    assert.equal(payload.correct, index % 2 === 0);
    assert.ok(Number.isFinite(payload.gained));
  });

  const revealResults = await Promise.all([hostReveal, ...playerReveal]);
  assert.equal(revealResults[0].correct, expectedAnswer);
  revealResults.slice(1).forEach((payload, index) => {
    assert.equal(payload.correct, index % 2 === 0);
    assert.equal(payload.total, players.length);
    assert.ok(payload.rank >= 1 && payload.rank <= players.length);
  });
});

test("feedback accepts validated submissions, derives session context, and rate limits accepted posts", async () => {
  const invalidRating = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 6, category: "bug", comments: "Invalid rating", role: "host" }),
  });
  assert.equal(invalidRating.status, 400);

  const invalidCategory = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 4, category: "security", comments: "Invalid category", role: "host" }),
  });
  assert.equal(invalidCategory.status, 400);

  const invalidEmail = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 4, category: "bug", comments: "Invalid email", email: "not-an-email", role: "player" }),
  });
  assert.equal(invalidEmail.status, 400);

  const invalidSession = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 4, category: "bug", comments: "Invalid session", role: "player", sessionId: "bad" }),
  });
  assert.equal(invalidSession.status, 400);

  const oversized = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 4, category: "bug", comments: "x".repeat(17000), role: "player" }),
  });
  assert.equal(oversized.status, 413);

  const general = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rating: 5,
      category: "suggestion",
      comments: "=Please keep the feedback form available before a quiz starts.",
      email: "",
      role: "host",
    }),
  });
  assert.equal(general.status, 201);
  const generalResult = await general.json();
  assert.equal(generalResult.ok, true);
  assert.deepEqual(generalResult.context, { sessionStatus: "not-provided", brand: null, phase: null });

  const realHost = await host(null);
  const contextual = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rating: 4,
      category: "ease-of-use",
      comments: "The batch actions are easier to find.",
      email: "HOST@EXAMPLE.COM",
      role: "host",
      sessionId: realHost.sessionId,
      brand: "microsoft",
      phase: "end",
      resumeToken: realHost.hostResumeToken,
    }),
  });
  assert.equal(contextual.status, 201);
  const contextualResult = await contextual.json();
  assert.deepEqual(contextualResult.context, { sessionStatus: "active", brand: "github", phase: "lobby" });

  const limited = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 3, category: "other", comments: "Third accepted post should be limited.", role: "unknown" }),
  });
  assert.equal(limited.status, 429);
});

test("admin dashboard securely monitors and controls sessions, codes, feedback, logs, and exports", async () => {
  assert.equal((await fetch(`${baseUrl}/api/admin/overview`)).status, 401);
  const badLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operatorName: "Integration Operator", passphrase: "wrong-admin-passphrase" }),
  });
  assert.equal(badLogin.status, 401);

  const admin = await adminLogin();
  const me = await adminFetch("/api/admin/me", admin);
  assert.equal(me.status, 200);
  const currentAdmin = await me.json();
  assert.equal(currentAdmin.operatorName, "Integration Operator");
  assert.equal(currentAdmin.csrfToken, admin.csrfToken);

  const domains = await adminFetch("/api/admin/host-domains", admin);
  assert.equal(domains.status, 200);
  const initialDomains = await domains.json();
  assert.deepEqual(initialDomains.protectedDomains, ["github.com", "microsoft.com"]);
  assert.deepEqual(initialDomains.partnerDomains, []);

  const missingDomainCsrf = await fetch(`${baseUrl}/api/admin/host-domains`, {
    method: "POST",
    headers: { cookie: admin.cookie, "content-type": "application/json" },
    body: JSON.stringify({ domain: "partner.example", reason: "Partner workshop" }),
  });
  assert.equal(missingDomainCsrf.status, 403);

  const protectedRemoval = await adminFetch("/api/admin/host-domains/github.com", admin, {
    method: "DELETE",
    body: JSON.stringify({ reason: "Protected-domain test" }),
  });
  assert.equal(protectedRemoval.status, 409);

  const addedDomain = await adminFetch("/api/admin/host-domains", admin, {
    method: "POST",
    body: JSON.stringify({ domain: "Partner.Example", reason: "Partner workshop" }),
  });
  assert.equal(addedDomain.status, 201);
  assert.deepEqual((await addedDomain.json()).partnerDomains, ["partner.example"]);

  const duplicateDomain = await adminFetch("/api/admin/host-domains", admin, {
    method: "POST",
    body: JSON.stringify({ domain: "partner.example", reason: "Duplicate test" }),
  });
  assert.equal(duplicateDomain.status, 409);

  const partnerHost = await connect();
  const partnerChallenge = await ack(partnerHost, "host:request-otp", "active@partner.example");
  assert.equal(partnerChallenge.ok, true);
  const partnerAuthorization = await ack(partnerHost, "host:join", {
    type: "otp",
    challengeId: partnerChallenge.challengeId,
    otp: partnerChallenge.testOtp,
  });
  assert.equal(partnerAuthorization.ok, true);
  partnerHost.sessionId = partnerAuthorization.sessionId;
  partnerHost.hostResumeToken = partnerAuthorization.resumeToken;
  partnerHost.isTestHost = true;

  const pendingPartner = await connect();
  const pendingChallenge = await ack(pendingPartner, "host:request-otp", "pending@partner.example");
  assert.equal(pendingChallenge.ok, true);

  const partnerManualCode = await adminFetch("/api/admin/access-codes", admin, {
    method: "POST",
    body: JSON.stringify({ email: "manual@partner.example", reason: "Partner mailbox support" }),
  });
  assert.equal(partnerManualCode.status, 201);
  const partnerAccess = await partnerManualCode.json();

  const removedDomain = await adminFetch("/api/admin/host-domains/partner.example", admin, {
    method: "DELETE",
    body: JSON.stringify({ reason: "Partner workshop completed" }),
  });
  assert.equal(removedDomain.status, 200);
  assert.deepEqual((await removedDomain.json()).partnerDomains, []);
  assert.equal((await ack(partnerHost, "host:set-duration", 45)).ok, true,
    "Removing a domain must not terminate an active host session");
  assert.equal((await ack(pendingPartner, "host:join", {
    type: "otp",
    challengeId: pendingChallenge.challengeId,
    otp: pendingChallenge.testOtp,
  })).ok, false, "A pending OTP must not authenticate after its domain is removed");
  const blockedOtpSocket = await connect();
  assert.equal((await ack(blockedOtpSocket, "host:request-otp", "new@partner.example")).ok, false);
  const blockedManualHost = await connect();
  assert.equal((await ack(blockedManualHost, "host:join", {
    type: "admin-code",
    email: "manual@partner.example",
    code: partnerAccess.code,
  })).ok, false);
  assert.equal((await adminFetch("/api/admin/access-codes", admin, {
    method: "POST",
    body: JSON.stringify({ email: "blocked@partner.example", reason: "Removed-domain test" }),
  })).status, 400);

  const missingCsrf = await fetch(`${baseUrl}/api/admin/access-codes`, {
    method: "POST",
    headers: { cookie: admin.cookie, "content-type": "application/json" },
    body: JSON.stringify({ email: "manual.host@microsoft.com", reason: "Mailbox delivery support" }),
  });
  assert.equal(missingCsrf.status, 403);

  const generated = await adminFetch("/api/admin/access-codes", admin, {
    method: "POST",
    body: JSON.stringify({ email: "manual.host@microsoft.com", reason: "Mailbox delivery support" }),
  });
  assert.equal(generated.status, 201);
  const access = await generated.json();
  assert.match(access.code, /^\d{6}$/);
  assert.equal(access.email, "manual.host@microsoft.com");

  const customExpiryStartedAt = Date.now();
  const customExpiry = await adminFetch("/api/admin/access-codes", admin, {
    method: "POST",
    body: JSON.stringify({
      email: "timed.host@github.com",
      reason: "Extended facilitated session",
      expiresMinutes: 30,
    }),
  });
  assert.equal(customExpiry.status, 201);
  const timedAccess = await customExpiry.json();
  const customExpiryMs = Date.parse(timedAccess.expiresAt) - customExpiryStartedAt;
  assert.ok(customExpiryMs >= 29 * 60 * 1000 && customExpiryMs <= 31 * 60 * 1000);

  const invalidExpiry = await adminFetch("/api/admin/access-codes", admin, {
    method: "POST",
    body: JSON.stringify({
      email: "invalid-expiry@github.com",
      reason: "Invalid expiration test",
      expiresMinutes: 1441,
    }),
  });
  assert.equal(invalidExpiry.status, 400);
  assert.match((await invalidExpiry.json()).error, /1 and 1440 whole minutes/i);

  const wrongCode = access.code === "000000" ? "000001" : "000000";
  const wrongSockets = await Promise.all([connect(), connect()]);
  const wrongAttempts = await Promise.all(wrongSockets.map(socket => ack(socket, "host:join", {
    type: "admin-code",
    email: "manual.host@microsoft.com",
    code: wrongCode,
  })));
  assert.deepEqual(wrongAttempts.map(result => result.ok), [false, false]);
  wrongSockets.forEach(socket => socket.disconnect());

  const manualHost = await connect();
  const manualAuthorization = await ack(manualHost, "host:join", {
    type: "admin-code",
    email: "manual.host@microsoft.com",
    code: access.code,
  });
  assert.equal(manualAuthorization.ok, true);
  manualHost.sessionId = manualAuthorization.sessionId;
  manualHost.hostResumeToken = manualAuthorization.resumeToken;
  manualHost.isTestHost = true;

  const reusedSocket = await connect();
  const reused = await ack(reusedSocket, "host:join", {
    type: "admin-code",
    email: "manual.host@microsoft.com",
    code: access.code,
  });
  assert.equal(reused.ok, false);
  reusedSocket.disconnect();

  const adminSocket = io(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    extraHeaders: { Cookie: admin.cookie },
  });
  sockets.add(adminSocket);
  await event(adminSocket, "connect");
  assert.equal((await ack(adminSocket, "admin:subscribe", {})).ok, true);

  const liveUpdate = event(adminSocket, "admin:update");
  const player = await connect(manualHost.sessionId);
  const joined = await joinPlayer(player, "Admin Test Player");
  assert.equal(joined.ok, true);
  await liveUpdate;

  const overviewResponse = await adminFetch("/api/admin/overview", admin);
  assert.equal(overviewResponse.status, 200);
  const overview = await overviewResponse.json();
  assert.ok(overview.connectedHosts >= 1);
  assert.ok(overview.activeSessions >= 1);
  assert.ok(overview.connectedParticipants >= 1);
  assert.ok(overview.newFeedback >= 1);

  const sessionsResponse = await adminFetch(`/api/admin/sessions?search=${encodeURIComponent(manualHost.sessionId)}`, admin);
  const sessionItems = (await sessionsResponse.json()).items;
  assert.equal(sessionItems.length, 1);
  assert.equal(sessionItems[0].hostEmail, "manual.host@microsoft.com");
  assert.equal(JSON.stringify(sessionItems).includes("hostResumeTokenHash"), false);
  assert.equal(JSON.stringify(sessionItems).includes("answers"), false);

  const participantsResponse = await adminFetch(`/api/admin/participants?search=${encodeURIComponent("Admin Test Player")}`, admin);
  const participantItems = (await participantsResponse.json()).items;
  assert.equal(participantItems.length, 1);
  assert.equal(participantItems[0].score, 0);
  assert.doesNotMatch(JSON.stringify(participantItems), /answered|lastCorrect|reconnectToken|socketId/);

  const detailResponse = await adminFetch(`/api/admin/sessions/${manualHost.sessionId}`, admin);
  assert.equal(detailResponse.status, 200);
  assert.doesNotMatch(JSON.stringify(await detailResponse.json()), /hostResumeTokenHash|reconnectTokenHash|"answers"/);

  const disconnected = event(player, "disconnect");
  const disconnectResponse = await adminFetch(
    `/api/admin/sessions/${manualHost.sessionId}/participants/${participantItems[0].id}/disconnect`,
    admin,
    { method: "POST", body: JSON.stringify({ reason: "Support verification" }) },
  );
  assert.equal(disconnectResponse.status, 200);
  await disconnected;

  const resetResponse = await adminFetch(`/api/admin/sessions/${manualHost.sessionId}/reset`, admin, {
    method: "POST",
    body: JSON.stringify({ reason: "Prepare the session for another round" }),
  });
  assert.equal(resetResponse.status, 200);
  assert.equal((await resetResponse.json()).session.phase, "lobby");

  const feedbackResponse = await adminFetch("/api/admin/feedback?status=new", admin);
  const feedbackItems = (await feedbackResponse.json()).items;
  assert.ok(feedbackItems.length >= 1);
  const feedback = feedbackItems.find(item => item.comments.startsWith("=")) || feedbackItems[0];
  const moderated = await adminFetch(`/api/admin/feedback/${feedback.id}`, admin, {
    method: "PATCH",
    body: JSON.stringify({
      status: "resolved",
      internalNote: "Validated in the admin integration test.",
      expectedRevision: feedback.revision,
    }),
  });
  assert.equal(moderated.status, 200);
  assert.equal((await moderated.json()).feedback.status, "resolved");

  const csvExport = await adminFetch("/api/admin/export?resource=feedback&format=csv", admin);
  assert.equal(csvExport.status, 200);
  assert.match(csvExport.headers.get("content-type"), /text\/csv/);
  assert.match(await csvExport.text(), /"'=Please/);
  const jsonExport = await adminFetch("/api/admin/export?resource=sessions&format=json", admin);
  assert.equal(jsonExport.status, 200);
  assert.doesNotMatch(await jsonExport.text(), /hostResumeTokenHash|reconnectTokenHash|"answers"/);

  const logsResponse = await adminFetch("/api/admin/logs?category=admin", admin);
  const logs = (await logsResponse.json()).items;
  assert.ok(logs.some(item => item.action === "admin.login"));
  assert.ok(logs.some(item => item.action === "session.reset"));
  assert.doesNotMatch(JSON.stringify(logs), /passphrase|csrf|digest|salt|otp|resumeToken/i);

  const expireResponse = await adminFetch(`/api/admin/sessions/${manualHost.sessionId}/expire`, admin, {
    method: "POST",
    body: JSON.stringify({ reason: "End the support verification session" }),
  });
  assert.equal(expireResponse.status, 200);
  assert.equal((await ack(await connect(), "session:inspect", manualHost.sessionId)).ok, false);

  const logout = await adminFetch("/api/admin/logout", admin, { method: "POST" });
  assert.equal(logout.status, 200);
  assert.equal((await adminFetch("/api/admin/me", admin)).status, 401);
});

test("legacy passphrase configuration requires explicit emergency enablement", async () => {
  const port = await availablePort();
  const processResult = await new Promise((resolve, reject) => {
    const probe = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
        HOST_EMAIL_MODE: "capture",
        HOST_PASSPHRASE: passphrase,
        ALLOW_LEGACY_HOST_PASSPHRASE: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let probeOutput = "";
    probe.stdout.on("data", data => { probeOutput += data; });
    probe.stderr.on("data", data => { probeOutput += data; });
    probe.once("error", reject);
    probe.once("exit", code => resolve({ code, output: probeOutput }));
  });
  assert.notEqual(processResult.code, 0);
  assert.match(processResult.output, /ALLOW_LEGACY_HOST_PASSPHRASE is not enabled/);
});

test("quiz sessions and their player links expire after configured inactivity", async () => {
  const port = await availablePort();
  const expiryUrl = `http://127.0.0.1:${port}`;
  const probe = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      PUBLIC_BASE_URL: expiryUrl,
      HOST_EMAIL_MODE: "capture",
      HOST_PASSPHRASE: passphrase,
      ALLOW_LEGACY_HOST_PASSPHRASE: "1",
      QUIZ_SESSION_TTL_SECONDS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let probeOutput = "";
  probe.stdout.on("data", data => { probeOutput += data; });
  probe.stderr.on("data", data => { probeOutput += data; });
  let socket;
  try {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${expiryUrl}/healthz`, { signal: AbortSignal.timeout(300) })).ok) break;
      } catch {}
      await delay(50);
    }
    socket = io(expiryUrl, { transports: ["websocket"], reconnection: false });
    await event(socket, "connect");
    const authorization = await ack(socket, "host:join", { type: "passphrase", passphrase });
    assert.equal(authorization.ok, true);
    await delay(1100);
    assert.equal((await ack(socket, "session:inspect", authorization.sessionId)).ok, false);
    assert.equal((await ack(socket, "host:resume-session", {
      sessionId: authorization.sessionId,
      token: authorization.resumeToken,
    })).ok, false);
    assert.equal((await fetch(`${expiryUrl}/qr?session=${authorization.sessionId}`)).status, 404);
  } finally {
    socket?.disconnect();
    if (probe.exitCode === null) {
      const exited = new Promise(resolve => probe.once("exit", resolve));
      probe.kill();
      await Promise.race([exited, delay(3000)]);
    }
  }
  assert.doesNotMatch(probeOutput, /Could not initialize durable quiz storage/);
});

test("admin-managed partner domains persist across restarts and enforce new host authentication", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-quiz-domain-restart-"));
  const domainFile = path.join(directory, "host-domains.json");
  let probe;
  async function startProbe() {
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}`;
    const processHandle = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PUBLIC_BASE_URL: url,
        HOST_EMAIL_MODE: "capture",
        HOST_DOMAIN_DATA_FILE: domainFile,
        ADMIN_PASSPHRASE: adminPassphrase,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let processOutput = "";
    processHandle.stdout.on("data", data => { processOutput += data; });
    processHandle.stderr.on("data", data => { processOutput += data; });
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(300) })).ok) {
          return { process: processHandle, url, output: () => processOutput };
        }
      } catch {}
      await delay(50);
    }
    throw new Error(`Domain persistence probe failed to start: ${processOutput}`);
  }
  async function stopProbe() {
    if (!probe || probe.process.exitCode !== null) return;
    const exited = new Promise(resolve => probe.process.once("exit", resolve));
    probe.process.kill();
    await Promise.race([exited, delay(3000)]);
    probe = null;
  }
  async function probeAdminLogin(url) {
    const response = await fetch(`${url}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operatorName: "Domain Operator", passphrase: adminPassphrase }),
    });
    assert.equal(response.status, 200);
    const session = await response.json();
    return { ...session, cookie: response.headers.get("set-cookie").split(";")[0] };
  }
  async function probeAdminFetch(url, pathname, session, options = {}) {
    return fetch(`${url}${pathname}`, {
      ...options,
      headers: {
        cookie: session.cookie,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(!["GET", "HEAD"].includes((options.method || "GET").toUpperCase())
          ? { "x-admin-csrf": session.csrfToken } : {}),
      },
    });
  }
  async function requestProbeOtp(url, email) {
    const socket = io(url, { transports: ["websocket"], reconnection: false });
    await event(socket, "connect");
    const result = await ack(socket, "host:request-otp", email);
    socket.disconnect();
    return result;
  }
  try {
    probe = await startProbe();
    let admin = await probeAdminLogin(probe.url);
    assert.equal((await probeAdminFetch(probe.url, "/api/admin/host-domains", admin, {
      method: "POST",
      body: JSON.stringify({ domain: "durable.partner", reason: "Durability test" }),
    })).status, 201);
    await stopProbe();

    probe = await startProbe();
    assert.equal((await requestProbeOtp(probe.url, "host@durable.partner")).ok, true);
    admin = await probeAdminLogin(probe.url);
    assert.equal((await probeAdminFetch(probe.url, "/api/admin/host-domains/durable.partner", admin, {
      method: "DELETE",
      body: JSON.stringify({ reason: "Durability removal test" }),
    })).status, 200);
    await stopProbe();

    probe = await startProbe();
    assert.equal((await requestProbeOtp(probe.url, "host@durable.partner")).ok, false);
    const persistedAdmin = await probeAdminLogin(probe.url);
    const settings = await probeAdminFetch(probe.url, "/api/admin/host-domains", persistedAdmin);
    assert.deepEqual((await settings.json()).partnerDomains, []);
  } finally {
    await stopProbe();
    await rm(directory, { recursive: true, force: true });
  }
});

test("an active quiz session restores from durable storage after a server restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-quiz-restart-"));
  const sessionFile = path.join(directory, "sessions.json");
  let first;
  let second;
  let hostSocket;
  let playerSocket;
  let anchorSocket;
  async function startProbe() {
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}`;
    const childProcess = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PUBLIC_BASE_URL: url,
        HOST_EMAIL_MODE: "capture",
        HOST_PASSPHRASE: passphrase,
        ALLOW_LEGACY_HOST_PASSPHRASE: "1",
        SESSION_DATA_FILE: sessionFile,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let processOutput = "";
    childProcess.stdout.on("data", data => { processOutput += data; });
    childProcess.stderr.on("data", data => { processOutput += data; });
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(300) })).ok) {
          return { process: childProcess, url, output: () => processOutput };
        }
      } catch {}
      await delay(50);
    }
    throw new Error(`Restart probe failed to start: ${processOutput}`);
  }
  async function stopProbe(probe) {
    if (!probe || probe.process.exitCode !== null) return;
    const exited = new Promise(resolve => probe.process.once("exit", resolve));
    probe.process.kill();
    await Promise.race([exited, delay(3000)]);
  }
  try {
    first = await startProbe();
    hostSocket = io(first.url, { transports: ["websocket"], reconnection: false });
    await event(hostSocket, "connect");
    const hostAuthorization = await ack(hostSocket, "host:join", { type: "passphrase", passphrase });
    assert.equal(hostAuthorization.ok, true);
    assert.equal((await ack(hostSocket, "host:select-batch", "batch-1")).ok, true);
    playerSocket = io(first.url, { transports: ["websocket"], reconnection: false });
    await event(playerSocket, "connect");
    const playerAuthorization = await ack(playerSocket, "player:join", {
      sessionId: hostAuthorization.sessionId,
      name: "Restarted player",
    });
    assert.equal(playerAuthorization.ok, true);
    anchorSocket = io(first.url, { transports: ["websocket"], reconnection: false });
    await event(anchorSocket, "connect");
    assert.equal((await ack(anchorSocket, "player:join", {
      sessionId: hostAuthorization.sessionId,
      name: "Anchor player",
    })).ok, true);
    const firstQuestion = event(hostSocket, "question");
    assert.equal((await ack(hostSocket, "host:start")).ok, true);
    assert.equal((await firstQuestion).index, 0);
    const answered = await ack(playerSocket, "player:answer", BATCHES["batch-1"].questions[0].c);
    assert.equal(answered.ok, true);
    hostSocket.disconnect();
    playerSocket.disconnect();
    anchorSocket.disconnect();
    await stopProbe(first);

    second = await startProbe();
    hostSocket = io(second.url, { transports: ["websocket"], reconnection: false });
    await event(hostSocket, "connect");
    const restoredQuestion = event(hostSocket, "question");
    const resumedHost = await ack(hostSocket, "host:resume-session", {
      sessionId: hostAuthorization.sessionId,
      token: hostAuthorization.resumeToken,
    });
    assert.equal(resumedHost.ok, true);
    assert.equal(resumedHost.phase, "question");
    assert.equal((await restoredQuestion).index, 0);

    playerSocket = io(second.url, { transports: ["websocket"], reconnection: false });
    await event(playerSocket, "connect");
    const resumedPlayerQuestion = event(playerSocket, "question");
    const resumedPlayer = await ack(playerSocket, "player:resume", {
      sessionId: hostAuthorization.sessionId,
      token: playerAuthorization.reconnectToken,
    });
    assert.equal(resumedPlayer.ok, true);
    assert.equal(resumedPlayer.phase, "question");
    assert.equal(resumedPlayer.answered, true);
    assert.equal(resumedPlayer.score, answered.gained);
    assert.equal((await resumedPlayerQuestion).answered, true);
  } finally {
    hostSocket?.disconnect();
    playerSocket?.disconnect();
    anchorSocket?.disconnect();
    await stopProbe(first);
    await stopProbe(second);
    await rm(directory, { recursive: true, force: true });
  }
});

test("all 48 questions and correct answers match the four supplied batches", () => {
  const normalize = text => text.replace(/\\([#_$\-{}])/g, "$1").replaceAll("**", "").trim();
  for (let number = 1; number <= 4; number++) {
    const source = readFileSync(path.join(root, `Batch-${number}.txt`), "utf8");
    const pairs = [...source.matchAll(/\*\*Question:\*\*\s*(.+?)\r?\n\s*\r?\n\*\*Answer:\*\*\s*(.+?)\r?\n/g)];
    assert.equal(pairs.length, 12, `Batch ${number} source question count`);
    pairs.forEach((pair, index) => {
      const question = BATCHES[`batch-${number}`].questions[index];
      assert.equal(question.q, normalize(pair[1]));
      assert.equal(question.o[question.c], normalize(pair[2]));
    });
  }
});

test("only the passphrase-authenticated host receives host events or controls the game", async () => {
  const spectator = await connect();
  const leaked = [];
  for (const type of ["state", "lobby", "question", "answered", "reveal", "end"]) {
    spectator.on(type, () => leaked.push(type));
  }
  const missing = await ack(spectator, "host:join", { type: "passphrase", passphrase: "" });
  assert.equal(missing.ok, false);
  assert.equal((await ack(spectator, "host:join", { type: "passphrase", passphrase: "wrong-passphrase" })).ok, false);
  const realHost = await host();
  const player = await connect(realHost.sessionId);
  assert.equal((await joinPlayer(player, "Test Player")).ok, true);
  assert.equal(leaked.length, 0, "Unauthorized host join leaked host state");

  spectator.emit("host:start");
  spectator.emit("host:next");
  spectator.emit("host:skip");
  spectator.emit("host:restart");
  assert.equal((await ack(spectator, "host:select-batch", "batch-2")).ok, false);
  assert.equal((await ack(spectator, "host:select-brand", "microsoft")).ok, false);
  assert.equal((await ack(spectator, "host:create-batch", { label: "No", questions: [] })).ok, false);
  assert.equal((await ack(spectator, "host:get-batch", "batch-1")).ok, false);
  assert.equal((await ack(spectator, "host:update-batch", { id: "batch-1" })).ok, false);
  assert.equal((await ack(spectator, "host:set-duration", 15)).ok, false);
  await delay(100);
  const question = event(realHost, "question");
  realHost.emit("host:start");
  assert.equal((await question).index, 0);
  assert.equal(leaked.length, 0, `Unauthenticated spectator received ${leaked}`);

  spectator.emit("host:skip");
  spectator.emit("host:restart");
  await delay(100);
  const rejected = await joinPlayer(player, "Late");
  assert.equal(rejected.ok, false, "An unauthorized restart must not reopen the lobby");
  const reveal = event(realHost, "reveal");
  realHost.emit("host:skip");
  assert.equal((await reveal).correct, BATCHES["batch-1"].questions[0].c);
  spectator.emit("host:next");
  await delay(100);
  assert.equal(leaked.length, 0);
  const reset = event(player, "reset");
  realHost.emit("host:restart");
  await reset;
});

test("two hosts run independent competitions without settings, players, or events crossing sessions", async () => {
  const hostA = await host("batch-1");
  const hostB = await host("batch-2");
  assert.notEqual(hostA.sessionId, hostB.sessionId);

  const playerA = await connect(hostA.sessionId);
  const playerB = await connect(hostB.sessionId);
  const lobbyA = event(hostA, "lobby");
  const lobbyB = event(hostB, "lobby");
  assert.equal((await joinPlayer(playerA, "Alpha")).ok, true);
  assert.equal((await joinPlayer(playerB, "Beta")).ok, true);
  assert.equal((await lobbyA).players.some(player => player.name === "Alpha"), true);
  assert.equal((await lobbyB).players.some(player => player.name === "Beta"), true);

  assert.equal((await ack(hostA, "host:set-duration", 10)).duration, 10);
  assert.equal((await ack(hostB, "host:set-duration", 30)).duration, 30);
  let hostBQuestionLeak = false;
  let playerBQuestionLeak = false;
  hostB.once("question", () => { hostBQuestionLeak = true; });
  playerB.once("question", () => { playerBQuestionLeak = true; });
  const hostAQuestion = event(hostA, "question");
  const playerAQuestion = event(playerA, "question");
  hostA.emit("host:start");
  assert.equal((await hostAQuestion).q, BATCHES["batch-1"].questions[0].q);
  assert.equal((await playerAQuestion).duration, 10);
  await delay(75);
  assert.equal(hostBQuestionLeak, false);
  assert.equal(playerBQuestionLeak, false);

  const hostBQuestion = event(hostB, "question");
  const playerBQuestion = event(playerB, "question");
  hostB.emit("host:start");
  assert.equal((await hostBQuestion).q, BATCHES["batch-2"].questions[0].q);
  assert.equal((await playerBQuestion).duration, 30);
  assert.equal((await ack(playerA, "player:answer", BATCHES["batch-1"].questions[0].c)).ok, true);
  assert.equal((await ack(playerB, "player:answer", BATCHES["batch-2"].questions[0].c)).ok, true);
});

test("host email OTP enforces exact allowed domains and challenge security", async () => {
  const socket = await connect();
  for (const email of [
    "person@example.com",
    "person@sub.microsoft.com",
    "person@microsoft.com.attacker.example",
    "person@@microsoft.com",
  ]) {
    const rejected = await ack(socket, "host:request-otp", email);
    assert.equal(rejected.ok, false, email);
    assert.equal(rejected.challengeId, undefined);
    assert.equal(rejected.testOtp, undefined);
  }

  const github = await ack(socket, "host:request-otp", "  Host.User@GitHub.com  ");
  assert.equal(github.ok, true);
  assert.match(github.challengeId, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(github.testOtp, /^\d{6}$/);
  assert.equal(github.email, "ho*******@github.com");
  const wrong = await ack(socket, "host:join", {
    type: "otp",
    challengeId: github.challengeId,
    otp: github.testOtp === "000000" ? "000001" : "000000",
  });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.attemptsRemaining, 4);
  const authorized = await ack(socket, "host:join", {
    type: "otp",
    challengeId: github.challengeId,
    otp: github.testOtp,
  });
  assert.equal(authorized.ok, true);
  assert.equal(authorized.email, "host.user@github.com");
  assert.equal((await ack(socket, "host:join", {
    type: "otp",
    challengeId: github.challengeId,
    otp: github.testOtp,
  })).ok, false, "OTP must be single use");

  const microsoft = await ack(socket, "host:request-otp", "host@microsoft.com");
  assert.equal(microsoft.ok, true);
  assert.equal((await ack(socket, "host:join", {
    type: "otp",
    challengeId: microsoft.challengeId,
    otp: microsoft.testOtp,
  })).ok, true);

  const supersededFirst = await ack(socket, "host:request-otp", "resend@github.com");
  const supersededSecond = await ack(socket, "host:request-otp", "resend@github.com");
  assert.equal((await ack(socket, "host:join", {
    type: "otp",
    challengeId: supersededFirst.challengeId,
    otp: supersededFirst.testOtp,
  })).ok, false);
  assert.equal((await ack(socket, "host:join", {
    type: "otp",
    challengeId: supersededSecond.challengeId,
    otp: supersededSecond.testOtp,
  })).ok, true);

  const exhausted = await ack(socket, "host:request-otp", "attempts@microsoft.com");
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await ack(socket, "host:join", {
      type: "otp",
      challengeId: exhausted.challengeId,
      otp: exhausted.testOtp === "111111" ? "222222" : "111111",
    });
    assert.equal(result.ok, false);
  }
  assert.equal((await ack(socket, "host:join", {
    type: "otp",
    challengeId: exhausted.challengeId,
    otp: exhausted.testOtp,
  })).ok, false, "Attempt-exhausted OTP must be invalidated");

  const expired = await ack(socket, "host:request-otp", "expired@github.com");
  await delay(1100);
  const expiredResult = await ack(socket, "host:join", {
    type: "otp",
    challengeId: expired.challengeId,
    otp: expired.testOtp,
  });
  assert.equal(expiredResult.ok, false);
  assert.match(expiredResult.error, /expired/i);

  for (let request = 0; request < 3; request++) {
    assert.equal((await ack(socket, "host:request-otp", "limited@microsoft.com")).ok, true);
  }
  const limited = await ack(socket, "host:request-otp", "limited@microsoft.com");
  assert.equal(limited.ok, false);
  assert.match(limited.error, /too many/i);
});

test("players cannot answer for each other, duplicate answers, or join mid-game", async () => {
  const realHost = await host();
  const alice = await connect(realHost.sessionId);
  const bob = await connect(realHost.sessionId);
  const outsider = await connect(realHost.sessionId);
  assert.equal((await joinPlayer(alice, "  Alice  ")).name, "Alice");
  assert.equal((await joinPlayer(bob, "Bob")).ok, true);
  const hostQuestion = event(realHost, "question");
  const aliceQuestion = event(alice, "question");
  realHost.emit("host:start");
  assert.equal((await hostQuestion).index, 0);
  const publicQuestion = await aliceQuestion;
  assert.equal(publicQuestion.count, 4);
  assert.equal(publicQuestion.o, undefined, "Correct answers and option text belong to the host");
  assert.equal((await ack(outsider, "player:answer", 1)).ok, false);
  assert.equal((await joinPlayer(outsider, "Latecomer")).ok, false);

  const aliceReveal = event(alice, "reveal");
  const bobReveal = event(bob, "reveal");
  const hostReveal = event(realHost, "reveal");
  const answer = BATCHES["batch-1"].questions[0].c;
  const wrong = (answer + 1) % 4;
  const correct = await ack(alice, "player:answer", answer);
  assert.equal(correct.ok, true);
  assert.equal(correct.correct, true);
  assert.equal((await ack(alice, "player:answer", answer)).ok, false);
  const incorrect = await ack(bob, "player:answer", wrong);
  assert.equal(incorrect.ok, true);
  assert.equal(incorrect.correct, false);
  const distribution = await hostReveal;
  assert.equal(distribution.dist[answer], 1);
  assert.equal(distribution.dist[wrong], 1);
  assert.equal(distribution.dist.reduce((sum, count) => sum + count, 0), 2);
  assert.equal((await aliceReveal).score, correct.gained);
  assert.equal((await bobReveal).score, 0);
  const reset = event(alice, "reset");
  realHost.emit("host:restart");
  await reset;
});

test("hosts can independently control question and answer-option visibility", async () => {
  const combinations = [
    { questionText: false, answerOptions: false },
    { questionText: true, answerOptions: false },
    { questionText: false, answerOptions: true },
    { questionText: true, answerOptions: true },
  ];
  for (const visibility of combinations) {
    const realHost = await host("batch-1");
    const player = await connect(realHost.sessionId);
    assert.equal((await joinPlayer(player, "Visibility tester")).ok, true);
    assert.deepEqual((await ack(realHost, "host:set-visibility", visibility)).visibility, visibility);
    const playerQuestion = event(player, "question");
    realHost.emit("host:start");
    const payload = await playerQuestion;
    const firstQuestion = BATCHES["batch-1"].questions[0];
    assert.equal(payload.q, visibility.questionText ? firstQuestion.q : undefined);
    assert.equal(payload.topic, visibility.questionText ? firstQuestion.t : undefined);
    assert.deepEqual(payload.o, visibility.answerOptions ? firstQuestion.o : undefined);
    assert.equal(payload.count, firstQuestion.o.length);
  }
});

test("host logout removes control access without breaking the sign-in socket", async () => {
  const realHost = await host();
  const oldSessionId = realHost.sessionId;
  assert.equal((await ack(realHost, "host:logout")).ok, true);
  assert.equal(realHost.connected, true);
  assert.equal((await ack(realHost, "host:select-batch", "batch-2")).ok, false);

  const lobby = event(realHost, "lobby");
  const signedInAgain = await ack(realHost, "host:join", { type: "passphrase", passphrase });
  assert.equal(signedInAgain.ok, true);
  assert.notEqual(signedInAgain.sessionId, oldSessionId);
  assert.equal((await lobby).phase, "lobby");
});

test("disconnected players and hosts resume the same isolated session securely", async () => {
  const realHost = await host();
  const player = await connect(realHost.sessionId);
  const joined = await joinPlayer(player, "Returning");
  assert.equal(joined.ok, true);
  assert.match(joined.reconnectToken, /^[A-Za-z0-9_-]{40,}$/);
  const anchor = await connect(realHost.sessionId);
  assert.equal((await joinPlayer(anchor, "Anchor")).ok, true);
  const question = event(realHost, "question");
  realHost.emit("host:start");
  await question;
  const correct = await ack(player, "player:answer", BATCHES["batch-1"].questions[0].c);
  assert.equal(correct.correct, true);
  player.disconnect();
  const playerConnected = event(player, "connect");
  player.connect();
  await playerConnected;
  const resumedQuestion = event(player, "question");
  const resumedPlayer = await resumePlayer(player, joined.reconnectToken);
  assert.equal(resumedPlayer.ok, true);
  assert.equal(resumedPlayer.name, "Returning");
  assert.equal(resumedPlayer.phase, "question");
  assert.equal(resumedPlayer.score, correct.gained);
  assert.equal(resumedPlayer.answered, true);
  assert.equal((await resumedQuestion).answered, true);
  assert.equal((await ack(player, "player:answer", BATCHES["batch-1"].questions[0].c)).ok, false);
  assert.equal((await resumePlayer(anchor, "invalid-token")).ok, false);

  realHost.disconnect();
  const hostConnected = event(realHost, "connect");
  realHost.connect();
  await hostConnected;
  realHost.emit("host:restart");
  await delay(100);
  assert.equal((await joinPlayer(player, "Still late")).ok, false);
  const currentQuestion = event(realHost, "question");
  const authorization = await ack(realHost, "host:resume-session", {
    sessionId: realHost.sessionId,
    token: realHost.hostResumeToken,
  });
  assert.equal(authorization.ok, true);
  assert.equal(authorization.phase, "question");
  const resumed = await currentQuestion;
  assert.equal(resumed.index, 0);
  assert.ok(resumed.remainingMs > 0 && resumed.remainingMs < 20000);
  const reset = event(player, "reset");
  realHost.emit("host:restart");
  await reset;
  player.disconnect();
  const reconnected = event(player, "connect");
  player.connect();
  await reconnected;
  const resumedLobby = await resumePlayer(player, joined.reconnectToken);
  assert.equal(resumedLobby.ok, true);
  assert.equal(resumedLobby.phase, "lobby");
  assert.equal(resumedLobby.score, 0);
});

test("batch must be selected per game; duration is lobby-only and validated", async () => {
  const realHost = await host(null);
  const player = await connect(realHost.sessionId);
  assert.equal((await joinPlayer(player, "Ready")).ok, true);
  assert.equal((await ack(realHost, "host:start")).ok, false);
  for (const value of [9, 121, 10.5, "20", null]) {
    assert.equal((await ack(realHost, "host:set-duration", value)).ok, false);
  }
  assert.equal((await ack(realHost, "host:select-batch", "batch-5")).ok, false);
  assert.equal((await ack(realHost, "host:set-duration", 120)).duration, 120);
  assert.equal((await ack(realHost, "host:set-duration", 10)).duration, 10);
  assert.equal((await ack(realHost, "host:select-batch", "batch-2")).batchId, "batch-2");
  const question = event(realHost, "question");
  assert.equal((await ack(realHost, "host:start")).ok, true);
  const first = await question;
  assert.equal(first.q, BATCHES["batch-2"].questions[0].q);
  assert.equal(first.duration, 10);
  assert.ok(first.remainingMs > 0 && first.remainingMs <= 10000);
  assert.equal((await ack(realHost, "host:select-batch", "batch-3")).ok, false);
  assert.equal((await ack(realHost, "host:select-brand", "microsoft")).ok, false);
  assert.equal((await ack(realHost, "host:create-batch", { label: "Late", questions: [] })).ok, false);
  assert.equal((await ack(realHost, "host:set-duration", 20)).ok, false);
  const reveal = event(realHost, "reveal", 12000);
  assert.equal((await reveal).correct, BATCHES["batch-2"].questions[0].c);
  const reset = event(realHost, "reset");
  const state = event(realHost, "lobby");
  realHost.emit("host:restart");
  await reset;
  const lobby = await state;
  assert.equal(lobby.batchId, null);
  assert.equal(lobby.duration, 20);
  assert.equal((await ack(realHost, "host:start")).ok, false);
});

test("brand selection and custom batches preserve metadata, option order, and variable sizes", async () => {
  const realHost = await host(null);
  const waitingPlayer = await connect(realHost.sessionId);
  assert.deepEqual(await waitingPlayer.initialBrand, { brand: "github" });
  const githubBrandEvent = event(waitingPlayer, "public:brand");
  const githubLobbyEvent = event(realHost, "lobby");
  assert.equal((await ack(realHost, "host:select-brand", "github")).brand, "github");
  assert.deepEqual(await githubBrandEvent, { brand: "github" });
  const githubLobby = await githubLobbyEvent;
  assert.equal(githubLobby.brand, "github");
  assert.equal(githubLobby.batches.length, 4);
  for (const batch of githubLobby.batches) {
    assert.equal(batch.brand, "github");
    assert.equal(batch.count, 12);
    assert.ok(Array.isArray(batch.tags) && batch.tags.length > 0);
  }

  const microsoftBrand = event(waitingPlayer, "public:brand");
  const microsoftLobbyEvent = event(realHost, "lobby");
  assert.equal((await ack(realHost, "host:select-brand", "microsoft")).brand, "microsoft");
  assert.deepEqual(await microsoftBrand, { brand: "microsoft" });
  const emptyMicrosoftLobby = await microsoftLobbyEvent;
  assert.equal(emptyMicrosoftLobby.brand, "microsoft");
  assert.deepEqual(emptyMicrosoftLobby.batches, []);

  const custom = {
    label: " Runtime Mix ",
    tags: ["Azure", "Copilot", "azure"],
    questions: [
      {
        title: "Two choices",
        prompt: " Pick the second option. ",
        options: [" First ", "Second"],
        correctAnswerIndex: 1,
      },
      {
        t: "Five choices",
        q: "Pick C.",
        o: ["A", "B", "C", "D", "E", "F", "G", "H"],
        c: 2,
      },
    ],
  };
  const createdLobbyEvent = event(realHost, "lobby");
  const created = await ack(realHost, "host:create-batch", custom);
  assert.equal(created.ok, true);
  assert.equal(created.batchId, "runtime-mix");
  assert.deepEqual(created.batch, {
    id: "runtime-mix",
    label: "Runtime Mix",
    brand: "microsoft",
    tags: ["Azure", "Copilot"],
    count: 2,
  });
  const createdLobby = await createdLobbyEvent;
  assert.deepEqual(createdLobby.batches, [created.batch]);

  const collision = await ack(realHost, "host:create-batch", custom);
  assert.equal(collision.batchId, "runtime-mix-2");
  const otherHost = await otpHost("privacy@microsoft.com");
  const otherMicrosoftLobby = event(otherHost, "lobby");
  assert.equal((await ack(otherHost, "host:select-brand", "microsoft")).ok, true);
  assert.deepEqual((await otherMicrosoftLobby).batches, [], "Custom batches must remain private to their creator");
  assert.equal((await ack(otherHost, "host:get-batch", created.batchId)).ok, false);
  otherHost.disconnect();
  assert.equal((await ack(realHost, "host:select-batch", created.batchId)).ok, true);
  const preview = await ack(realHost, "host:get-batch", created.batchId);
  assert.equal(preview.ok, true);
  assert.equal(preview.batch.questions.length, 2);
  assert.deepEqual(preview.batch.questions[1].options, ["A", "B", "C", "D", "E", "F", "G", "H"]);
  assert.equal((await ack(realHost, "host:update-batch", {
    id: collision.batchId,
    ...custom,
  })).ok, false, "Only the selected batch can be updated");
  const updated = await ack(realHost, "host:update-batch", {
    id: created.batchId,
    ...custom,
    label: "Runtime Mix Updated",
    tags: ["Azure AI Foundry", "Fabric"],
  });
  assert.equal(updated.ok, true);
  assert.deepEqual(updated.batch, {
    id: "runtime-mix",
    label: "Runtime Mix Updated",
    brand: "microsoft",
    tags: ["Azure AI Foundry", "Fabric"],
    count: 2,
  });
  const updatedPreview = await ack(realHost, "host:get-batch", created.batchId);
  assert.equal(updatedPreview.batch.label, "Runtime Mix Updated");
  assert.deepEqual(updatedPreview.batch.tags, ["Azure AI Foundry", "Fabric"]);

  const player = await connect(realHost.sessionId);
  const initialBrand = await player.initialBrand;
  assert.deepEqual(initialBrand, { brand: "microsoft" });
  const joined = await joinPlayer(player, "Variable");
  assert.equal(joined.ok, true);
  assert.equal(joined.brand, "microsoft");
  const firstHostQuestion = event(realHost, "question");
  const firstPlayerQuestion = event(player, "question");
  assert.equal((await ack(realHost, "host:start")).ok, true);
  const firstHost = await firstHostQuestion;
  const firstPlayer = await firstPlayerQuestion;
  assert.equal(firstHost.brand, "microsoft");
  assert.equal(firstHost.total, 2);
  assert.deepEqual(firstHost.tags, ["Azure AI Foundry", "Fabric"]);
  assert.deepEqual(firstHost.o, ["First", "Second"]);
  assert.equal(firstPlayer.brand, "microsoft");
  assert.equal(firstPlayer.count, 2);
  assert.equal(firstPlayer.o, undefined);

  assert.equal((await ack(realHost, "host:select-brand", "github")).ok, false);
  assert.equal((await ack(realHost, "host:select-batch", "batch-1")).ok, false);
  assert.equal((await ack(realHost, "host:create-batch", custom)).ok, false);

  const firstRevealEvent = event(realHost, "reveal");
  const firstPlayerRevealEvent = event(player, "reveal");
  assert.equal((await ack(player, "player:answer", 1)).correct, true);
  const firstReveal = await firstRevealEvent;
  assert.deepEqual(firstReveal.options, ["First", "Second"]);
  assert.deepEqual(firstReveal.dist, [0, 1]);
  assert.equal(firstReveal.brand, "microsoft");
  assert.equal((await firstPlayerRevealEvent).optionCount, 2);

  const secondHostQuestion = event(realHost, "question");
  const secondPlayerQuestion = event(player, "question");
  realHost.emit("host:next");
  assert.deepEqual((await secondHostQuestion).o, ["A", "B", "C", "D", "E", "F", "G", "H"]);
  assert.equal((await secondPlayerQuestion).count, 8);
  const secondRevealEvent = event(realHost, "reveal");
  assert.equal((await ack(player, "player:answer", 2)).correct, true);
  assert.deepEqual((await secondRevealEvent).dist, [0, 0, 1, 0, 0, 0, 0, 0]);

  const ended = event(realHost, "end");
  realHost.emit("host:next");
  assert.equal((await ended).brand, "microsoft");
  const reset = event(realHost, "reset");
  const lobby = event(realHost, "lobby");
  realHost.emit("host:restart");
  assert.deepEqual(await reset, { phase: "lobby", brand: "microsoft", batchId: null, duration: 20 });
  const resetLobby = await lobby;
  assert.equal(resetLobby.brand, "microsoft");
  assert.equal(resetLobby.batchId, null);
  assert.deepEqual(resetLobby.batches.map(batch => batch.id), ["runtime-mix", "runtime-mix-2"]);
});

test("player UI supports runtime options and host UI exposes prompt, paste, and review editing", () => {
  const playerHtml = readFileSync(path.join(root, "public", "player.html"), "utf8");
  const hostHtml = readFileSync(path.join(root, "public", "host.html"), "utf8");
  const feedbackHtml = readFileSync(path.join(root, "public", "feedback.html"), "utf8");
  const adminHtml = readFileSync(path.join(root, "public", "admin.html"), "utf8");
  const serverSource = readFileSync(path.join(root, "server.js"), "utf8");
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(playerHtml, /const labels=\["A","B","C","D","E","F","G","H"\]/);
  for (const index of [4, 5, 6, 7]) assert.match(playerHtml, new RegExp(`\\.a${index}\\{background:`));
  assert.match(hostHtml, /correctAnswerIndex:question\.correctOption/);
  assert.match(hostHtml, /\.\.\.\(question\.explanation\.trim\(\)\?\{explanation:question\.explanation\.trim\(\)\}: \{\}\)/);
  assert.match(hostHtml, /host:get-batch/);
  assert.match(hostHtml, /host:update-batch/);
  assert.match(hostHtml, /Save as new batch/);
  assert.match(hostHtml, /Update selected batch/);
  assert.match(playerHtml, /localStorage\.setItem\(PLAYER_SESSION_KEY/);
  assert.match(playerHtml, /player:resume/);
  assert.match(playerHtml, /q\.answered/);
  assert.match(hostHtml, /Create questions with any AI tool/);
  assert.match(hostHtml, /id="prepareQuestionsBtn"[^>]*>Prepare prompt and paste questions</);
  assert.match(hostHtml, /id="copyExternalAiPromptBtn"[^>]*>Copy prompt</);
  assert.match(hostHtml, /BatchPromptBuilder\.build/);
  assert.match(hostHtml, /id="promptSourceMode"/);
  assert.match(hostHtml, /Microsoft 365 Copilot \+ slide deck/);
  assert.match(hostHtml, /id="bulkPastePanel"/);
  assert.match(hostHtml, /id="manualBatchEditor"/);
  assert.match(hostHtml, /class="brand-option-logo"/);
  assert.match(hostHtml, /<html lang="en" data-brand="github" data-entry="auth">/);
  assert.match(hostHtml, /<title>Live Quiz · Host<\/title>/);
  assert.match(hostHtml, /id="brandLabel"[^>]*>Live Quiz · Host</);
  assert.match(hostHtml, /id="authBtn"[^>]*>Send code</);
  assert.match(hostHtml, /if\(manualCodeMode\)authenticateManualCode\(\);\s*else if\(hostChallengeId\)authenticate\(\);\s*else requestOtp\(\);/);
  assert.match(hostHtml, /const OTP_REQUEST_TIMEOUT_MS=60000;/);
  assert.match(hostHtml, /timeout\(OTP_REQUEST_TIMEOUT_MS\)\.emit\("host:request-otp"/);
  assert.match(hostHtml, /\$\("authBtn"\)\.textContent="Verify code"/);
  assert.match(hostHtml, /viewBox="-1 -1 18 18"/);
  assert.doesNotMatch(hostHtml, /Unlock host controls/);
  assert.match(hostHtml, /id="downloadQrBtn"/);
  assert.match(hostHtml, /id="copyJoinLinkBtn"/);
  assert.match(hostHtml, /id="largeQrBtn"/);
  assert.match(hostHtml, /id="createBatchBtn"[^>]*>[\s\S]*?<svg[^>]*>[\s\S]*?<span>New batch<\/span>/);
  assert.match(hostHtml, /id="previewBatchBtn"[^>]*>[\s\S]*?<svg[^>]*>[\s\S]*?<span>Preview<\/span>/);
  assert.match(hostHtml, /id="editSelectedBatchBtn"[^>]*>[\s\S]*?<svg[^>]*>[\s\S]*?<span>Edit<\/span>/);
  assert.match(hostHtml, /role="group" aria-label="Question batch actions"/);
  assert.match(hostHtml, /\.batch-control\{[^}]*flex:1 0 100%;width:100%/);
  assert.match(hostHtml, /\.batch-control\{align-items:stretch;flex-direction:column/);
  assert.match(hostHtml, /\.batch-action\{width:100%\}/);
  assert.match(hostHtml, /id="manualCodeBtn"[^>]*>Use admin-provided code</);
  assert.match(hostHtml, /\{type:"admin-code",email,code\}/);
  assert.match(hostHtml, /id="logoutHostBtn"/);
  assert.match(hostHtml, /value="questionText"/);
  assert.match(hostHtml, /value="answerOptions"/);
  assert.match(hostHtml, /function view\(id\)/);
  assert.match(playerHtml, /id="qPrompt"/);
  assert.match(adminHtml, /id="accessExpiryMinutes"/);
  assert.match(hostHtml, /id="hostFeedbackLink"/);
  assert.match(playerHtml, /id="playerFeedbackLink"/);
  assert.match(feedbackHtml, /id="feedbackForm"/);
  assert.match(feedbackHtml, /name="rating"/);
  assert.match(feedbackHtml, /value="quiz-content"/);
  assert.match(feedbackHtml, /maxlength="2000"/);
  assert.match(feedbackHtml, /fetch\("\/api\/feedback"/);
  assert.match(serverSource, /createFeedbackRepository/);
  assert.match(serverSource, /feedbackRepository\.createFeedback\(submission\)/);
  assert.doesNotMatch(feedbackHtml, /resumeToken|reconnectToken/);
  for (const view of ["overview", "hosts", "sessions", "participants", "logs", "domains", "access", "feedback", "exports"]) {
    assert.match(adminHtml, new RegExp(`data-view="${view}"`));
  }
  assert.match(adminHtml, /id="actionDialog"/);
  assert.match(adminHtml, /id="domainForm"/);
  assert.match(adminHtml, /\/api\/admin\/host-domains/);
  assert.match(adminHtml, /x-admin-csrf/);
  assert.match(adminHtml, /admin:subscribe/);
  assert.doesNotMatch(adminHtml, /ADMIN_PASSPHRASE|hostResumeTokenHash|reconnectTokenHash/);
  assert.match(hostHtml, /id="qrOverlay"/);
  assert.match(hostHtml, /download="solution-engineer-quiz-join-qr\.png"/);
  assert.match(hostHtml, /fetch\(`\/qr\?\$\{query\}&size=1024`\)/);
  assert.match(hostHtml, /host:resume-session/);
  assert.match(hostHtml, /sessionStorage\.setItem\(HOST_SESSION_KEY/);
  assert.match(playerHtml, /session:inspect/);
  assert.match(playerHtml, /\{sessionId,name:n\}/);
  assert.match(playerHtml, /--teal:#39c5cf;--pink:#f778ba/);
  assert.match(hostHtml, /document\.addEventListener\("fullscreenchange",syncFullscreen\)/);
  assert.match(hostHtml, /html\[data-presenting="true"\] \.settings,/);
  assert.match(hostHtml, /<script src="\/batch-prompt-builder\.js"><\/script>/);
  assert.match(hostHtml, /<script src="\/batch-text-parser\.js"><\/script>/);
  assert.match(hostHtml, /BatchTextParser\.parse\(source/);
  assert.doesNotMatch(hostHtml, /Saved drafts|host:save-draft|host:list-drafts|host:get-draft/);
  assert.match(hostHtml, /allowed-company\.com/);
  assert.match(hostHtml, /\{type:"otp",challengeId:hostChallengeId,otp\}/);
  assert.doesNotMatch(hostHtml, /hostPassphrase|HOST_OTP_PREVIEW/);
  assert.equal(packageJson.dependencies["@azure/communication-email"], "^1.1.0");
  assert.equal(packageJson.dependencies["@azure/msal-browser"], undefined);
  assert.equal(packageJson.dependencies.jose, undefined);
  assert.doesNotMatch(hostHtml, /Generate with AI|host:generate-batch|aiBatchPanel/);
  assert.doesNotMatch(serverSource, /host:generate-batch|createAiBatchGenerator/);
});

test("custom batch creation rejects malformed and oversized payloads without changing the catalog", async () => {
  const realHost = await host(null);
  assert.equal((await ack(realHost, "host:select-brand", "microsoft")).ok, true);
  const beforeEvent = event(realHost, "lobby");
  assert.equal((await ack(realHost, "host:select-brand", "microsoft")).ok, true);
  const before = await beforeEvent;
  const originalIds = before.batches.map(batch => batch.id);

  const invalid = [
    null,
    { label: "Missing questions" },
    { label: "Too few options", questions: [{ t: "Bad", q: "Bad?", o: ["Only"], c: 0 }] },
    { label: "Too many options", questions: [{ t: "Bad", q: "Bad?", o: Array.from({ length: 9 }, (_, i) => String(i)), c: 0 }] },
    { label: "Bad answer", questions: [{ t: "Bad", q: "Bad?", o: ["A", "B"], c: 2 }] },
    { label: "X".repeat(101), questions: [{ t: "Bad", q: "Bad?", o: ["A", "B"], c: 0 }] },
    { label: "Huge field", questions: [{ t: "Bad", q: "Q".repeat(1001), o: ["A", "B"], c: 0 }] },
  ];
  for (const payload of invalid) {
    const result = await ack(realHost, "host:create-batch", payload);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, "string");
  }
  const oversized = await ack(realHost, "host:create-batch", {
    label: "Oversized",
    ignored: "x".repeat(910 * 1024),
    questions: [{ t: "Valid", q: "Valid?", o: ["A", "B"], c: 0 }],
  });
  assert.equal(oversized.ok, false);
  assert.match(oversized.error, /too large/i);

  const afterEvent = event(realHost, "lobby");
  assert.equal((await ack(realHost, "host:select-brand", "microsoft")).ok, true);
  assert.deepEqual((await afterEvent).batches.map(batch => batch.id), originalIds);
});

test("all four batches play their twelve supplied questions with one correct choice each", async () => {
  const realHost = await host(null);
  const player = await connect(realHost.sessionId);
  assert.equal((await joinPlayer(player, "Batch tester")).ok, true);
  for (const [id, batch] of Object.entries(BATCHES)) {
    assert.equal(batch.questions.length, 12, id);
    assert.equal((await ack(realHost, "host:select-batch", id)).ok, true);
    for (let index = 0; index < 12; index++) {
      const hostQuestion = event(realHost, "question");
      const playerQuestion = event(player, "question");
      realHost.emit(index === 0 ? "host:start" : "host:next");
      const hostPayload = await hostQuestion;
      const publicPayload = await playerQuestion;
      assert.equal(hostPayload.q, batch.questions[index].q);
      assert.deepEqual(hostPayload.o, batch.questions[index].o);
      assert.equal(hostPayload.total, 12);
      assert.equal(publicPayload.total, 12);
      assert.equal(publicPayload.o, undefined);
      assert.equal(publicPayload.duration, 20);
      assert.ok(publicPayload.remainingMs > 0);
      const hostReveal = event(realHost, "reveal");
      const playerReveal = event(player, "reveal");
      assert.equal((await ack(player, "player:answer", batch.questions[index].c)).correct, true);
      assert.equal((await hostReveal).correct, batch.questions[index].c);
      assert.equal((await playerReveal).correct, true);
    }
    const ended = event(realHost, "end");
    realHost.emit("host:next");
    assert.equal((await ended).podium.length, 1);
    const reset = event(realHost, "reset");
    const lobby = event(realHost, "lobby");
    realHost.emit("host:restart");
    await reset;
    assert.equal((await lobby).batchId, null);
  }
});

test("100 concurrent WebSocket players complete a full quiz within the latency target", async () => {
  const realHost = await host(null);
  realHost.disconnect();

  const runner = spawn(process.execPath, [
    "scripts/load-test.js", "--batch", "batch-1", "--duration", "20",
    "--players", "100", "--sustain-ms", "5000", "--timeout-ms", "15000",
    "--max-p95-ms", "1000",
  ], {
    cwd: root,
    env: { ...process.env, BASE_URL: baseUrl, HOST_PASSPHRASE: passphrase },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  runner.stdout.on("data", chunk => { stdout += chunk; });
  runner.stderr.on("data", chunk => { stderr += chunk; });
  const timeout = setTimeout(() => runner.kill(), 60000);
  try {
    const exitCode = await new Promise((resolve, reject) => {
      runner.once("error", reject);
      runner.once("close", resolve);
    });
    assert.equal(exitCode, 0, `100-player load run failed:\n${stderr}\n${stdout}`);
    const reportStart = stdout.indexOf("\n{");
    assert.notEqual(reportStart, -1, `Load runner did not produce a report:\n${stdout}`);
    const report = JSON.parse(stdout.slice(reportStart + 1));
    assert.equal(report.requestedPlayers, 100);
    assert.equal(report.joinedPlayers, 100);
    assert.equal(report.minimumConnectedPlayers, 100);
    assert.equal(report.questions, 12);
    assert.equal(report.answerAcks, 1200);
    assert.equal(report.disconnectedUnexpectedly, 0);
    assert.equal(report.http5xx, 0);
    assert.equal(report.errors, 0);
    assert.ok(report.p95AckMs <= 1000, `p95 answer acknowledgement: ${report.p95AckMs}ms`);
  } finally {
    clearTimeout(timeout);
    if (runner.exitCode === null) runner.kill();
  }
});
