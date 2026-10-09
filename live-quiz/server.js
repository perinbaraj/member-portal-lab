// GitHub Platform Challenge — Live multiplayer quiz (Kahoot-style)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } = require("crypto");
const path = require("path");
const { BATCHES, BRANDS, generateBatchId, normalizeBatch } = require("./questions");
const { createAdminControlPlane } = require("./admin-control-plane");
const { createAccessCodeRepository } = require("./repositories/access-code-repository");
const { createAuditEventRepository } = require("./repositories/audit-event-repository");
const { createBatchRepository } = require("./repositories/batch-repository");
const { createFeedbackRepository } = require("./repositories/feedback-repository");
const { createHostDomainRepository } = require("./repositories/host-domain-repository");
const { createQuizSessionRepository } = require("./repositories/quiz-session-repository");
const { createHostEmailService } = require("./services/host-email");

const batches = { ...BATCHES };
const accessCodeRepository = createAccessCodeRepository();
const auditRepository = createAuditEventRepository();
const batchRepository = createBatchRepository();
const feedbackRepository = createFeedbackRepository();
const sessionRepository = createQuizSessionRepository();
const MAX_CUSTOM_BATCH_BYTES = 900 * 1024;
const FEEDBACK_CATEGORIES = new Set(["bug", "suggestion", "quiz-content", "ease-of-use", "other"]);

const PORT = process.env.PORT === undefined ? 4000 : Number(process.env.PORT);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error("Invalid PORT.");
const DEFAULT_ALLOWED_HOST_DOMAINS = ["github.com", "microsoft.com"];
function normalizeAllowedHostDomains(input) {
  const values = Array.isArray(input) ? input : String(input ?? "").split(",");
  const normalized = [...new Set(values
    .map(value => String(value).trim().toLowerCase())
    .filter(Boolean))];
  if (!normalized.length) {
    throw new Error("HOST_ALLOWED_EMAIL_DOMAINS must include at least one valid domain.");
  }
  for (const domain of normalized) {
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) || domain.split(".").some(label => label.startsWith("-") || label.endsWith("-"))) {
      throw new Error(`Invalid host email domain in HOST_ALLOWED_EMAIL_DOMAINS: ${domain}`);
    }
  }
  return normalized;
}
const configuredHostDomains = normalizeAllowedHostDomains(
  process.env.HOST_ALLOWED_EMAIL_DOMAINS || DEFAULT_ALLOWED_HOST_DOMAINS.join(","),
);
const configuredPartnerDomains = configuredHostDomains.filter(domain => !DEFAULT_ALLOWED_HOST_DOMAINS.includes(domain));
const hostDomainRepository = createHostDomainRepository(process.env, configuredPartnerDomains);
let allowedHostDomains = [...DEFAULT_ALLOWED_HOST_DOMAINS, ...configuredPartnerDomains];
function getAllowedHostDomains() {
  return [...allowedHostDomains];
}
function setPartnerHostDomains(input) {
  const values = Array.isArray(input) ? input : [];
  const partnerDomains = values.length
    ? normalizeAllowedHostDomains(values).filter(domain => !DEFAULT_ALLOWED_HOST_DOMAINS.includes(domain))
    : [];
  allowedHostDomains = [...DEFAULT_ALLOWED_HOST_DOMAINS, ...partnerDomains];
  return getAllowedHostDomains();
}
const allowLegacyHostPassphrase = process.env.ALLOW_LEGACY_HOST_PASSPHRASE === "1";
const legacyPassphrase = process.env.HOST_PASSPHRASE;
const legacyCharacterGroups = typeof legacyPassphrase === "string"
  ? [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(re => re.test(legacyPassphrase)).length : 0;
if (typeof legacyPassphrase === "string" && (legacyPassphrase.length < 16 || legacyPassphrase.length > 1024 || legacyCharacterGroups < 3)) {
  throw new Error("HOST_PASSPHRASE must be 16–1024 characters with at least three character classes when configured.");
}
const hostPassphraseHash = typeof legacyPassphrase === "string" ? createHash("sha256").update(legacyPassphrase).digest() : null;
if (legacyPassphrase && !allowLegacyHostPassphrase) {
  throw new Error("HOST_PASSPHRASE is configured but ALLOW_LEGACY_HOST_PASSPHRASE is not enabled.");
}
const hostEmailService = createHostEmailService();
function integerSetting(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}
const hostOtpTtlMs = integerSetting("HOST_OTP_TTL_SECONDS", 600, 1, 3600) * 1000;
const hostOtpMaxAttempts = integerSetting("HOST_OTP_MAX_ATTEMPTS", 5, 1, 20);
const hostOtpResendCooldownMs = integerSetting("HOST_OTP_RESEND_SECONDS", 60, 0, 3600) * 1000;
const hostOtpWindowMs = integerSetting("HOST_OTP_RATE_WINDOW_SECONDS", 3600, 1, 86400) * 1000;
const hostOtpEmailRequestLimit = integerSetting("HOST_OTP_EMAIL_REQUEST_LIMIT", 5, 1, 100);
const hostOtpIpRequestLimit = integerSetting("HOST_OTP_IP_REQUEST_LIMIT", 20, 1, 1000);
const quizSessionTtlMs = integerSetting("QUIZ_SESSION_TTL_SECONDS", 86400, 1, 604800) * 1000;
const feedbackRateWindowMs = integerSetting("FEEDBACK_RATE_WINDOW_SECONDS", 3600, 1, 86400) * 1000;
const feedbackRateLimit = integerSetting("FEEDBACK_RATE_LIMIT", 10, 1, 100);
const hostOtpChallenges = new Map();
const hostOtpChallengeByEmail = new Map();
const hostOtpRequestsInFlight = new Set();
const hostOtpRequestsByEmail = new Map();
const hostOtpRequestsByIp = new Map();
const feedbackRequestsByIp = new Map();
let adminControlPlane = null;
const inAzure = Boolean(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_INSTANCE_ID);
const local = !inAzure && process.env.NODE_ENV !== "production";
let publicBaseUrl;
if (process.env.PUBLIC_BASE_URL) {
  const configured = process.env.PUBLIC_BASE_URL;
  let parsed;
  try { parsed = new URL(configured); } catch { throw new Error("Invalid PUBLIC_BASE_URL."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !(loopback && local && parsed.protocol === "http:"))
    || (loopback && !local)
    || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("PUBLIC_BASE_URL must be an HTTPS origin (HTTP loopback only for local development).");
  }
  publicBaseUrl = parsed.origin;
} else if (!local) {
  throw new Error("PUBLIC_BASE_URL is required in Azure/production.");
}

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, { perMessageDeflate: false });

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "host.html")));
app.get("/play", (req, res) => {
  const sessionId = validSessionId(req.query.session) ? req.query.session : "";
  res.redirect(`/player.html${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ""}`);
});
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.post("/api/feedback", express.json({ limit: "16kb", type: "application/json" }), async (req, res) => {
  const input = req.body;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return res.status(400).json({ error: "Submit feedback as a JSON object." });
  }
  const rating = input.rating;
  const category = typeof input.category === "string" ? input.category.trim().toLowerCase() : "";
  const comments = typeof input.comments === "string" ? input.comments.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = typeof input.role === "string" ? input.role.trim().toLowerCase() : "unknown";
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Choose a rating from 1 to 5." });
  }
  if (!FEEDBACK_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Choose a valid feedback category." });
  }
  if (!comments || comments.length > 2000) {
    return res.status(400).json({ error: "Enter feedback using 1 to 2000 characters." });
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: "Enter a valid contact email or leave it blank." });
  }
  if (!["host", "player", "unknown"].includes(role)) {
    return res.status(400).json({ error: "Choose a valid feedback role." });
  }
  if (sessionId && !validSessionId(sessionId)) {
    return res.status(400).json({ error: "The quiz session context is invalid." });
  }

  const now = Date.now();
  const rateKey = req.ip || req.socket.remoteAddress || "unknown";
  const recent = (feedbackRequestsByIp.get(rateKey) || []).filter(timestamp => timestamp > now - feedbackRateWindowMs);
  if (recent.length >= feedbackRateLimit) {
    feedbackRequestsByIp.set(rateKey, recent);
    return res.status(429).json({ error: "Too many feedback submissions. Please try again later." });
  }

  const session = sessionId ? activeSession(sessionId, now) : null;
  const submission = {
    id: randomUUID(),
    rating,
    category,
    comments,
    email: email || null,
    role,
    sessionId: sessionId || null,
    sessionStatus: session ? "active" : sessionId ? "unavailable" : "not-provided",
    brand: session?.brand || null,
    phase: session?.phase || null,
    createdAt: new Date(now).toISOString(),
  };
  try {
    const stored = await feedbackRepository.createFeedback(submission);
    recent.push(now);
    feedbackRequestsByIp.set(rateKey, recent);
    adminControlPlane?.recordEventInBackground({
      category: "feedback",
      action: "feedback.submitted",
      outcome: "success",
      actorType: role,
      sessionId: submission.sessionId,
      details: { feedbackId: stored.id, category: stored.category, rating: stored.rating, sessionStatus: stored.sessionStatus },
    });
    adminControlPlane?.scheduleBroadcast("feedback");
    return res.status(201).json({
      ok: true,
      id: submission.id,
      context: {
        sessionStatus: submission.sessionStatus,
        brand: submission.brand,
        phase: submission.phase,
      },
    });
  } catch (error) {
    console.error("Could not persist feedback.", { message: error.message });
    return res.status(500).json({ error: "Feedback could not be saved. Please try again." });
  }
});
app.use((error, req, res, next) => {
  if (req.path !== "/api/feedback") return next(error);
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "Feedback payload is too large." });
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json({ error: "Feedback must be valid JSON." });
  }
  return next(error);
});
app.get("/qr", async (req, res) => {
  const sessionId = validSessionId(req.query.session) ? req.query.session : "";
  const session = sessionId ? activeSession(sessionId) : null;
  if (!session) return res.status(404).json({ error: "Quiz session not found or expired." });
  const base = publicBaseUrl || `http://localhost:${server.address().port}`;
  const url = `${base}/play?session=${encodeURIComponent(session.id)}`;
  const requested = req.query.size;
  let width = 420;
  let share = false;
  if (requested !== undefined) {
    if (Array.isArray(requested) || !/^\d{3,4}$/.test(String(requested))) {
      return res.status(400).json({ error: "Invalid QR size." });
    }
    width = Number(requested);
    if (width < 200 || width > 1200) return res.status(400).json({ error: "Invalid QR size." });
    share = true;
  }
  const color = share
    ? { dark: "#000000", light: "#ffffff" }
    : { dark: "#e6edf3", light: "#0d1117" };
  try {
    const dataUrl = await QRCode.toDataURL(url, { width, margin: share ? 2 : 1, color });
    res.json({ dataUrl, url });
  } catch (_e) { res.status(500).json({ error: "Could not create QR code." }); }
});

// ---- Isolated quiz sessions ----
const sessions = new Map();
const sessionSaveChains = new Map();
const sessionPendingPersists = new Map();
const expiringSessionIds = new Set();
const hostSocketsBySession = new Map();

function validSessionId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(value);
}
function tokenHash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function tokenHashMatches(candidate, expected) {
  if (!/^[a-f0-9]{64}$/.test(candidate || "") || !/^[a-f0-9]{64}$/.test(expected || "")) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
}
function activeSession(id, now = Date.now()) {
  const session = validSessionId(id) ? sessions.get(id) : null;
  if (!session || expiringSessionIds.has(id) || session.expiresAt <= now) return null;
  return session;
}
function hostRoom(sessionId) {
  return `session:${sessionId}:host`;
}
function audienceRoom(sessionId) {
  return `session:${sessionId}:audience`;
}
function playerRoom(sessionId, playerId) {
  return `session:${sessionId}:player:${playerId}`;
}
function createSession(ownerUserId, hostEmail) {
  const now = Date.now();
  const resumeToken = randomBytes(32).toString("base64url");
  const session = {
    id: randomBytes(18).toString("base64url"),
    ownerUserId,
    hostEmail: hostEmail || null,
    hostResumeTokenHash: tokenHash(resumeToken),
    phase: "lobby",
    brand: "github",
    visibility: normalizeVisibilityPolicy(),
    batchId: null,
    qIndex: -1,
    players: {},
    answers: {},
    qStart: 0,
    qEnd: 0,
    duration: 20,
    reveal: null,
    end: null,
    createdAt: now,
    lastActivityAt: now,
    hostLastSeenAt: now,
    expiresAt: now + quizSessionTtlMs,
    timer: null,
  };
  sessions.set(session.id, session);
  return { session, resumeToken };
}
function touchSession(session) {
  const now = Date.now();
  session.lastActivityAt = now;
  session.expiresAt = now + quizSessionTtlMs;
}
function persistedSession(session) {
  return {
    ...session,
    timer: undefined,
    players: Object.fromEntries(Object.entries(session.players).map(([id, player]) => [id, {
      ...player,
      socketId: undefined,
      connected: false,
    }])),
  };
}
function hydrateSession(stored) {
  return {
    ...stored,
    visibility: normalizeVisibilityPolicy(stored.visibility),
    timer: null,
    hostLastSeenAt: stored.hostLastSeenAt || stored.lastActivityAt || stored.createdAt,
    players: Object.fromEntries(Object.entries(stored.players || {}).map(([id, player]) => [id, {
      ...player,
      socketId: null,
      connected: false,
      joinedAt: player.joinedAt || stored.createdAt,
      lastSeenAt: player.lastSeenAt || stored.lastActivityAt || stored.createdAt,
    }])),
    answers: stored.answers || {},
  };
}
function persistSession(session) {
  if (expiringSessionIds.has(session.id)) return Promise.resolve();
  const previous = sessionSaveChains.get(session.id) || Promise.resolve();
  const next = previous.then(() => sessionRepository.saveSession(persistedSession(session)));
  sessionSaveChains.set(session.id, next.catch(() => {}));
  return next;
}
function persistSoon(session) {
  const pending = sessionPendingPersists.get(session.id);
  if (pending) return pending.promise;
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  const timer = setTimeout(() => {
    sessionPendingPersists.delete(session.id);
    persistSession(session).then(resolve, reject);
  }, 25);
  timer.unref();
  sessionPendingPersists.set(session.id, { timer, promise, resolve, reject });
  return promise;
}
function persistInBackground(session) {
  void persistSoon(session).catch(error => {
    console.error("Could not persist quiz session.", { sessionId: session.id, message: error.message });
  });
}
function isHostConnected(sessionId) {
  return (hostSocketsBySession.get(sessionId)?.size || 0) > 0;
}
function recordActivity(event) {
  adminControlPlane?.recordEventInBackground(event);
}
function notifyAdmins(reason) {
  adminControlPlane?.scheduleBroadcast(reason);
}
function questions(session) {
  return batches[session.batchId].questions;
}
function batchSummary(batch) {
  return {
    id: batch.id,
    label: batch.label,
    brand: batch.brand || "github",
    tags: [...(batch.tags || [])],
    count: batch.questions.length
  };
}
function persistedBatch(batch) {
  return {
    ...normalizeBatch(batch, { path: "persistedBatch" }),
    ownerUserId: batch.ownerUserId || null,
    source: batch.source || "manual",
    revision: batch.revision,
  };
}
function batchDetails(batch) {
  return {
    ...batchSummary(batch),
    questions: batch.questions.map(question => ({
      topic: question.topic ?? question.t,
      prompt: question.prompt ?? question.q,
      options: [...(question.options ?? question.o)],
      correctAnswerIndex: question.correctAnswerIndex ?? question.c,
      ...((question.explanation ?? question.e) ? { explanation: question.explanation ?? question.e } : {})
    }))
  };
}
function validateBatchPayload(input) {
  let serialized;
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw new TypeError("Batch payload must be valid JSON.");
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > MAX_CUSTOM_BATCH_BYTES) {
    throw new RangeError("Batch payload is too large.");
  }
}
const DEFAULT_VISIBILITY_POLICY = {
  questionText: true,
  answerOptions: false,
};
function normalizeVisibilityPolicy(policy = {}) {
  const resolved = { ...DEFAULT_VISIBILITY_POLICY, ...(policy || {}) };
  return {
    questionText: Boolean(resolved.questionText),
    answerOptions: Boolean(resolved.answerOptions),
  };
}
function batchVisibleTo(batch, hostUserId) {
  return !batch.ownerUserId || batch.ownerUserId === hostUserId;
}
function availableBatches(session) {
  return Object.values(batches)
    .filter(batch => (batch.brand || "github") === session.brand && batchVisibleTo(batch, session.ownerUserId))
    .map(batchSummary);
}
function lobbyState(session) {
  return { players: playerList(session), count: Object.keys(session.players).length, phase: session.phase,
    brand: session.brand, batchId: session.batchId, duration: session.duration,
    visibility: normalizeVisibilityPolicy(session.visibility), sessionId: session.id,
    batches: availableBatches(session) };
}

function playerList(session) {
  return Object.values(session.players).map(p => ({ name: p.name, score: p.score, connected: p.connected }));
}
function leaderboard(session) {
  return Object.entries(session.players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score, best: p.best }))
    .sort((a, b) => b.score - a.score);
}
function publicQuestion(session) {
  const q = questions(session)[session.qIndex];
  return { index: session.qIndex, total: questions(session).length, topic: q.t, q: q.q, o: q.o,
    brand: session.brand, tags: q.tags, duration: session.duration,
    remainingMs: Math.max(0, session.qEnd - Date.now()) };
}
function broadcastLobby(session) {
  io.to(hostRoom(session.id)).emit("lobby", lobbyState(session));
}
function playerQuestion(session, player) {
  const policy = normalizeVisibilityPolicy(session.visibility);
  const pub = publicQuestion(session);
  const payload = {
    index: pub.index,
    total: pub.total,
    brand: session.brand,
    tags: pub.tags,
    duration: session.duration,
    remainingMs: pub.remainingMs,
    answered: player.answered,
    count: pub.o.length,
  };
  if (policy.questionText) {
    payload.topic = pub.topic;
    payload.q = pub.q;
  }
  if (policy.answerOptions) {
    payload.o = pub.o;
  }
  return payload;
}
function playerReveal(session, playerId, player) {
  const lb = leaderboard(session);
  return {
    brand: session.brand,
    streak: player.streak,
    score: player.score,
    rank: lb.findIndex(row => row.id === playerId) + 1,
    total: lb.length,
    correct: player.lastCorrect,
    optionCount: session.reveal.options.length,
  };
}
function playerEnd(session, playerId, player) {
  const lb = leaderboard(session);
  return {
    brand: session.brand,
    name: player.name,
    rank: lb.findIndex(row => row.id === playerId) + 1,
    total: lb.length,
    score: player.score,
  };
}
function sendVisibilityState(socket, session) {
  socket.emit("lobby", lobbyState(session));
}
function sendPlayerState(socket, session, playerId) {
  const player = session.players[playerId];
  if (!player) return;
  if (session.phase === "question") socket.emit("question", playerQuestion(session, player));
  else if (session.phase === "reveal") socket.emit("reveal", playerReveal(session, playerId, player));
  else if (session.phase === "end") socket.emit("end", playerEnd(session, playerId, player));
}
function attachPlayer(socket, session, playerId) {
  const player = session.players[playerId];
  if (!player) return;
  if (player.socketId && player.socketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(player.socketId);
    if (previousSocket) {
      previousSocket.data.playerId = null;
      previousSocket.leave(playerRoom(session.id, playerId));
      previousSocket.emit("session:replaced");
    }
  }
  socket.data.sessionId = session.id;
  socket.data.playerId = playerId;
  socket.join(audienceRoom(session.id));
  socket.join(playerRoom(session.id, playerId));
  player.socketId = socket.id;
  player.connected = true;
  player.lastSeenAt = Date.now();
  touchSession(session);
  notifyAdmins("participant");
}

function normalizeHostEmail(email) {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254 || trimmed !== email.trim().toLowerCase()) return null;
  const separator = trimmed.indexOf("@");
  if (separator <= 0 || separator !== trimmed.lastIndexOf("@")) return null;
  const localPart = trimmed.slice(0, separator);
  const domain = trimmed.slice(separator + 1);
  if (!localPart || localPart.length > 64 || !domain || domain.length > 128) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) return null;
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)) return null;
  if (domain.split(".").some(label => label.startsWith("-") || label.endsWith("-"))) return null;
  return { email: trimmed, localPart, domain };
}

function hostDomainAllowed(email) {
  const parsed = normalizeHostEmail(email);
  if (!parsed) return false;
  return allowedHostDomains.includes(parsed.domain);
}

function authenticate(candidate) {
  if (typeof candidate !== "string" || candidate.length > 1024) return false;
  if (hostPassphraseHash === null || !allowLegacyHostPassphrase) return false;
  const hash = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(hash, hostPassphraseHash);
}

function hostIdentityFromEmail(email) {
  const parsed = normalizeHostEmail(email);
  if (!parsed) return null;
  return `host:${createHash("sha256").update(parsed.email).digest("hex").slice(0, 32)}`;
}

function otpDigest(challengeId, salt, otp) {
  return createHash("sha256").update(`${challengeId}:${salt}:${otp}`).digest();
}

function pruneRequestWindow(entries, now) {
  if (!entries) return [];
  return entries.filter(timestamp => timestamp > now - hostOtpWindowMs);
}

function consumeRequestLimit(store, key, limit, now) {
  const entries = pruneRequestWindow(store.get(key), now);
  if (entries.length >= limit) {
    store.set(key, entries);
    return false;
  }
  entries.push(now);
  store.set(key, entries);
  return true;
}

function clientIp(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length <= 512) {
    const last = forwarded.split(",").at(-1).trim();
    if (last) return last;
  }
  return socket.handshake.address || "unknown";
}

function maskEmail(email) {
  const parsed = normalizeHostEmail(email);
  if (!parsed) return "";
  const visible = parsed.localPart.slice(0, Math.min(2, parsed.localPart.length));
  return `${visible}${"*".repeat(Math.max(1, parsed.localPart.length - visible.length))}@${parsed.domain}`;
}

function removeOtpChallenge(challengeId) {
  const challenge = hostOtpChallenges.get(challengeId);
  if (!challenge) return;
  hostOtpChallenges.delete(challengeId);
  if (hostOtpChallengeByEmail.get(challenge.email) === challengeId) {
    hostOtpChallengeByEmail.delete(challenge.email);
  }
}

function pruneExpiredOtpChallenges(now) {
  for (const [challengeId, challenge] of hostOtpChallenges) {
    if (challenge.expiresAt <= now) removeOtpChallenge(challengeId);
  }
}

function verifyOtpChallenge(challengeId, otp) {
  if (typeof challengeId !== "string" || challengeId.length > 128 || typeof otp !== "string") {
    return { ok: false, error: "Invalid or expired access code." };
  }
  const challenge = hostOtpChallenges.get(challengeId);
  if (!challenge) return { ok: false, error: "Invalid or expired access code." };
  const now = Date.now();
  if (challenge.expiresAt <= now) {
    removeOtpChallenge(challengeId);
    return { ok: false, error: "The access code expired. Request a new code." };
  }
  const candidate = otp.trim();
  challenge.attempts += 1;
  if (!/^\d{6}$/.test(candidate)
    || !timingSafeEqual(otpDigest(challengeId, challenge.salt, candidate), challenge.digest)) {
    if (challenge.attempts >= hostOtpMaxAttempts) {
      removeOtpChallenge(challengeId);
      return { ok: false, error: "Too many incorrect attempts. Request a new code." };
    }
    return {
      ok: false,
      error: "Invalid access code.",
      attemptsRemaining: hostOtpMaxAttempts - challenge.attempts,
    };
  }
  removeOtpChallenge(challengeId);
  return { ok: true, email: challenge.email };
}

function hostOnly(socket, action) {
  return (...args) => {
    const session = socket.data.isHost ? activeSession(socket.data.sessionId) : null;
    if (!session || session.ownerUserId !== socket.data.hostUserId) {
      const ack = args.at(-1);
      if (typeof ack === "function") ack({ ok: false, error: "Host session expired. Sign in again." });
      return;
    }
    action(session, ...args);
  };
}
async function persistForAcknowledgement(session, ack) {
  try {
    await persistSoon(session);
    return true;
  } catch (error) {
    console.error("Could not persist acknowledged quiz change.", {
      sessionId: session.id,
      message: error.message,
    });
    if (typeof ack === "function") ack({ ok: false, error: "Could not save the quiz session. Try again." });
    return false;
  }
}
function currentReveal(session) {
  const q = questions(session)[session.qIndex];
  const dist = Array(q.o.length).fill(0);
  for (const idx of Object.values(session.answers)) if (idx >= 0 && idx < q.o.length) dist[idx]++;
  return { correct: q.c, options: q.o, explanation: q.e || `Correct answer: ${q.o[q.c]}`, dist,
    brand: session.brand, tags: q.tags, leaderboard: leaderboard(session).slice(0, 8),
    last: session.qIndex + 1 >= questions(session).length };
}

function getHostIdentity(socket) {
  return socket.data.hostUserId || socket.data.hostEmail || null;
}

function resolveExpectedRevision(input, current, fallbackLabel = "batch") {
  if (input && Object.prototype.hasOwnProperty.call(input, "revision")) {
    return Number(input.revision);
  }
  if (current && Number.isInteger(current.revision)) {
    return current.revision;
  }
  return 1;
}
function sendHostState(socket, session) {
  socket.emit("lobby", lobbyState(session));
  if (session.phase === "question" || session.phase === "reveal") {
    socket.emit("question", publicQuestion(session));
    if (session.phase === "question") socket.emit("answered", {
      answered: Object.values(session.players).filter(p => p.answered).length,
      total: Object.keys(session.players).length
    });
    else socket.emit("reveal", session.reveal);
  } else if (session.phase === "end") socket.emit("end", session.end);
}
function attachHost(socket, session, hostUserId, hostEmail) {
  socket.data.isHost = true;
  socket.data.hostUserId = hostUserId;
  socket.data.hostEmail = hostEmail || session.hostEmail;
  socket.data.sessionId = session.id;
  socket.join(hostRoom(session.id));
  socket.join(audienceRoom(session.id));
  let hostSockets = hostSocketsBySession.get(session.id);
  if (!hostSockets) {
    hostSockets = new Set();
    hostSocketsBySession.set(session.id, hostSockets);
  }
  hostSockets.add(socket.id);
  session.hostLastSeenAt = Date.now();
  touchSession(session);
  notifyAdmins("host");
}

io.on("connection", (socket) => {
  socket.on("session:inspect", (sessionId, ack) => {
    const session = activeSession(sessionId);
    if (session) {
      socket.data.sessionId = session.id;
      socket.join(audienceRoom(session.id));
    }
    if (typeof ack === "function") ack(session
      ? { ok: true, sessionId: session.id, brand: session.brand, phase: session.phase }
      : { ok: false, error: "This quiz link is invalid or expired." });
  });

  socket.on("host:join", async (candidate, ack) => {
    const payload = candidate && typeof candidate === "object" ? candidate : {};
    let authenticatedEmail = null;
    let authenticatedByPassphrase = false;
    let authenticationMethod = payload.type;
    let authError = "Invalid host credentials.";
    let otpResult = null;
    if (payload.type === "otp") {
      otpResult = verifyOtpChallenge(payload.challengeId, payload.otp);
      if (otpResult.ok && hostDomainAllowed(otpResult.email)) authenticatedEmail = otpResult.email;
      else if (otpResult.ok) authError = "This email domain is no longer allowed to host quizzes.";
      else authError = otpResult.error;
    } else if (payload.type === "admin-code") {
      try {
        const manualResult = adminControlPlane
          ? await adminControlPlane.verifyManualHostCode(payload.email, payload.code)
          : { ok: false, error: "Admin-provided codes are not configured." };
        if (manualResult.ok) authenticatedEmail = manualResult.email;
        else authError = manualResult.error;
      } catch (error) {
        console.error("Could not verify admin-provided host code.", error);
        authError = "Could not verify the admin-provided code. Try again.";
      }
    } else if (payload.type === "passphrase" && allowLegacyHostPassphrase) {
      authenticatedByPassphrase = authenticate(payload.passphrase);
    }
    if (!authenticatedEmail && !authenticatedByPassphrase) {
      socket.data.isHost = false;
      socket.leave("host");
      if (typeof ack === "function") ack({
        ok: false,
        error: authError,
        ...(payload.type === "otp" && Number.isInteger(otpResult?.attemptsRemaining)
          ? { attemptsRemaining: otpResult.attemptsRemaining } : {}),
      });
      recordActivity({
        category: "auth", action: "host.login", outcome: "failed", actorType: "host",
        actorId: authenticatedEmail ? hostIdentityFromEmail(authenticatedEmail) : null,
        details: { method: authenticationMethod },
      });
      return;
    }
    const hostUserId = hostIdentityFromEmail(authenticatedEmail)
      || `host:${createHash("sha256").update(`emergency:${payload.passphrase}`).digest("hex").slice(0, 32)}`;
    const { session, resumeToken } = createSession(hostUserId, authenticatedEmail);
    attachHost(socket, session, hostUserId, authenticatedEmail);
    try {
      await persistSession(session);
    } catch (error) {
      sessions.delete(session.id);
      socket.leave(hostRoom(session.id));
      socket.data.isHost = false;
      if (typeof ack === "function") ack({ ok: false, error: "Could not create a durable quiz session." });
      return;
    }
    recordActivity({
      category: "auth", action: "host.login", outcome: "success", actorType: "host",
      actorId: hostUserId, sessionId: session.id,
      details: { email: authenticatedEmail, method: authenticationMethod },
    });
    notifyAdmins("session");
    const base = publicBaseUrl || `http://localhost:${server.address().port}`;
    if (typeof ack === "function") ack({
      ok: true,
      phase: session.phase,
      hostUserId,
      email: socket.data.hostEmail,
      sessionId: session.id,
      resumeToken,
      joinUrl: `${base}/play?session=${encodeURIComponent(session.id)}`,
    });
    sendHostState(socket, session);
  });

  socket.on("host:resume-session", async (input, ack) => {
    const session = input && activeSession(input.sessionId);
    const candidateHash = typeof input?.token === "string" && input.token.length <= 128
      ? tokenHash(input.token) : "";
    if (!session || !tokenHashMatches(candidateHash, session.hostResumeTokenHash)) {
      if (typeof ack === "function") ack({ ok: false, error: "Saved host session is invalid or expired." });
      return;
    }
    attachHost(socket, session, session.ownerUserId, session.hostEmail);
    if (!await persistForAcknowledgement(session, ack)) return;
    const base = publicBaseUrl || `http://localhost:${server.address().port}`;
    if (typeof ack === "function") ack({
      ok: true,
      phase: session.phase,
      hostUserId: session.ownerUserId,
      email: session.hostEmail,
      sessionId: session.id,
      joinUrl: `${base}/play?session=${encodeURIComponent(session.id)}`,
    });
    sendHostState(socket, session);
    recordActivity({
      category: "auth", action: "host.resume", outcome: "success", actorType: "host",
      actorId: session.ownerUserId, sessionId: session.id, details: { email: session.hostEmail },
    });
  });

  socket.on("host:request-otp", async (email, ack) => {
    const parsed = normalizeHostEmail(email);
    if (!parsed || !hostDomainAllowed(parsed.email)) {
      if (typeof ack === "function") ack({ ok: false, error: "Use an exact work email address from an allowed domain." });
      return;
    }
    const now = Date.now();
    pruneExpiredOtpChallenges(now);
    if (hostOtpRequestsInFlight.has(parsed.email)) {
      if (typeof ack === "function") ack({ ok: false, error: "An access-code request is already in progress." });
      return;
    }
    const previousChallengeId = hostOtpChallengeByEmail.get(parsed.email);
    const previousChallenge = previousChallengeId ? hostOtpChallenges.get(previousChallengeId) : null;
    if (previousChallenge && previousChallenge.createdAt > now - hostOtpResendCooldownMs) {
      const retryAfterSeconds = Math.ceil((previousChallenge.createdAt + hostOtpResendCooldownMs - now) / 1000);
      if (typeof ack === "function") ack({
        ok: false,
        error: `Wait ${retryAfterSeconds} seconds before requesting another code.`,
        retryAfterSeconds,
      });
      return;
    }
    const ip = clientIp(socket);
    if (!consumeRequestLimit(hostOtpRequestsByEmail, parsed.email, hostOtpEmailRequestLimit, now)
      || !consumeRequestLimit(hostOtpRequestsByIp, ip, hostOtpIpRequestLimit, now)) {
      if (typeof ack === "function") ack({
        ok: false,
        error: "Too many access-code requests. Try again later.",
      });
      return;
    }

    const challengeId = randomBytes(32).toString("base64url");
    const salt = randomBytes(16).toString("base64url");
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    hostOtpRequestsInFlight.add(parsed.email);
    try {
      await hostEmailService.sendHostOtp({
        to: parsed.email,
        otp,
        expiresMinutes: Math.ceil(hostOtpTtlMs / 60000),
      });
    } catch (error) {
      console.error("Could not send host access code.", {
        name: error?.name || "Error",
        code: error?.code || "",
        statusCode: error?.statusCode || "",
      });
      if (typeof ack === "function") ack({ ok: false, error: "Could not send the access code. Try again." });
      return;
    } finally {
      hostOtpRequestsInFlight.delete(parsed.email);
    }

    if (previousChallengeId) removeOtpChallenge(previousChallengeId);
    hostOtpChallenges.set(challengeId, {
      email: parsed.email,
      salt,
      digest: otpDigest(challengeId, salt, otp),
      createdAt: now,
      expiresAt: now + hostOtpTtlMs,
      attempts: 0,
    });
    hostOtpChallengeByEmail.set(parsed.email, challengeId);
    recordActivity({
      category: "auth", action: "host.otp-requested", outcome: "success", actorType: "host",
      actorId: hostIdentityFromEmail(parsed.email), details: { email: parsed.email },
    });
    if (typeof ack === "function") ack({
      ok: true,
      challengeId,
      email: maskEmail(parsed.email),
      expiresInSeconds: hostOtpTtlMs / 1000,
      retryAfterSeconds: hostOtpResendCooldownMs / 1000,
      testOtp: process.env.NODE_ENV === "test" && hostEmailService.mode === "capture" ? otp : undefined,
    });
  });

  socket.on("player:join", async (input, cb) => {
    const session = input && activeSession(input.sessionId);
    let name = typeof input?.name === "string" ? input.name.trim().slice(0, 20) : "";
    if (socket.data.isHost || socket.data.playerId) {
      if (typeof cb === "function") cb({ ok: false, error: "This connection already belongs to a quiz session." });
      return;
    }
    if (!session) {
      if (typeof cb === "function") cb({ ok: false, error: "This quiz link is invalid or expired." });
      return;
    }
    if (!name) { if (typeof cb === "function") cb({ ok: false, error: "Enter a name." }); return; }
    if (session.phase !== "lobby") {
      if (typeof cb === "function") cb({ ok: false, error: "Game already started. Wait for the host to restart, then join again." });
      return;
    }
    const playerId = randomUUID();
    const reconnectToken = randomBytes(32).toString("base64url");
    const joinedAt = Date.now();
    session.players[playerId] = { name, score: 0, streak: 0, best: 0, answered: false,
      lastCorrect: false, connected: true, socketId: socket.id, reconnectTokenHash: tokenHash(reconnectToken),
      joinedAt, lastSeenAt: joinedAt };
    attachPlayer(socket, session, playerId);
    if (!await persistForAcknowledgement(session, cb)) {
      delete session.players[playerId];
      socket.data.playerId = null;
      return;
    }
    if (typeof cb === "function") cb({ ok: true, name, brand: session.brand,
      reconnectToken, sessionId: session.id, phase: session.phase, score: 0, answered: false });
    broadcastLobby(session);
    recordActivity({
      category: "participant", action: "participant.join", outcome: "success", actorType: "player",
      sessionId: session.id, participantId: playerId, participantName: name,
    });
    notifyAdmins("participant");
  });
  socket.on("player:resume", async (input, cb) => {
    const session = input && activeSession(input.sessionId);
    const candidateHash = typeof input?.token === "string" && input.token.length <= 128
      ? tokenHash(input.token) : "";
    if (socket.data.isHost || (socket.data.playerId && socket.data.sessionId !== input?.sessionId)
      || !session || !candidateHash) {
      if (typeof cb === "function") cb({ ok: false, error: "Saved player session is invalid." });
      return;
    }
    const entry = Object.entries(session.players)
      .find(([, player]) => tokenHashMatches(candidateHash, player.reconnectTokenHash));
    const playerId = entry?.[0];
    const player = entry?.[1];
    if (!player) {
      if (typeof cb === "function") cb({ ok: false, error: "Saved player session has expired." });
      return;
    }
    attachPlayer(socket, session, playerId);
    if (!await persistForAcknowledgement(session, cb)) return;
    if (typeof cb === "function") cb({ ok: true, name: player.name, brand: session.brand,
      sessionId: session.id, phase: session.phase, score: player.score, answered: player.answered });
    sendPlayerState(socket, session, playerId);
    broadcastLobby(session);
    recordActivity({
      category: "participant", action: "participant.resume", outcome: "success", actorType: "player",
      sessionId: session.id, participantId: playerId, participantName: player.name,
    });
  });

  socket.on("host:logout", (ack) => {
    const session = socket.data.isHost && socket.data.sessionId ? activeSession(socket.data.sessionId) : null;
    if (session && session.ownerUserId === socket.data.hostUserId) {
      const hostSockets = hostSocketsBySession.get(session.id);
      if (hostSockets) {
        hostSockets.delete(socket.id);
        if (!hostSockets.size) hostSocketsBySession.delete(session.id);
      }
      socket.leave(hostRoom(session.id));
      socket.leave(audienceRoom(session.id));
      socket.data.isHost = false;
      socket.data.hostUserId = null;
      socket.data.hostEmail = null;
      socket.data.sessionId = null;
      session.hostLastSeenAt = Date.now();
      touchSession(session);
      persistInBackground(session);
      notifyAdmins("host");
    }
    if (typeof ack === "function") ack({ ok: true });
  });
  socket.on("host:select-batch", hostOnly(socket, async (session, id, ack) => {
    const batch = typeof id === "string" ? batches[id] : null;
    if (session.phase !== "lobby" || !batch || (batch.brand || "github") !== session.brand
      || !batchVisibleTo(batch, session.ownerUserId)) {
      if (typeof ack === "function") ack({ ok: false, error: "Choose a valid batch in the lobby." });
      return;
    }
    session.batchId = id;
    touchSession(session);
    if (!await persistForAcknowledgement(session, ack)) return;
    broadcastLobby(session);
    if (typeof ack === "function") ack({ ok: true, batchId: id, batch: batchSummary(batch) });
  }));
  socket.on("host:get-batch", hostOnly(socket, (session, id, ack) => {
    const batch = typeof id === "string" ? batches[id] : null;
    if (session.phase !== "lobby" || !batch || (batch.brand || "github") !== session.brand
      || !batchVisibleTo(batch, session.ownerUserId)) {
      if (typeof ack === "function") ack({ ok: false, error: "Choose a valid batch in the lobby." });
      return;
    }
    if (typeof ack === "function") ack({ ok: true, batch: batchDetails(batch) });
  }));
  socket.on("host:select-brand", hostOnly(socket, async (session, brand, ack) => {
    if (session.phase !== "lobby" || typeof brand !== "string" || !BRANDS.includes(brand.toLowerCase())) {
      if (typeof ack === "function") ack({ ok: false, error: "Choose a valid brand in the lobby." });
      return;
    }
    session.brand = brand.toLowerCase();
    if (session.batchId && (batches[session.batchId].brand || "github") !== session.brand) session.batchId = null;
    touchSession(session);
    if (!await persistForAcknowledgement(session, ack)) return;
    io.to(audienceRoom(session.id)).emit("public:brand", { brand: session.brand });
    broadcastLobby(session);
    if (typeof ack === "function") ack({ ok: true, brand: session.brand, batchId: session.batchId });
  }));
  socket.on("host:create-batch", hostOnly(socket, async (session, input, ack) => {
    if (session.phase !== "lobby") {
      if (typeof ack === "function") ack({ ok: false, error: "Create batches only in the lobby." });
      return;
    }
    try {
      validateBatchPayload(input);
      const existingIds = Object.keys(batches);
      const id = generateBatchId(input && input.label, existingIds);
      const batch = normalizeBatch({ ...input, id, brand: session.brand }, {
        path: "batch",
        existingIds
      });
      const hostUserId = session.ownerUserId;
      const saved = await batchRepository.createBatch(batch, {
        state: "active",
        source: "manual",
        ownerUserId: hostUserId,
        updatedBy: hostUserId,
      });
      batches[id] = persistedBatch(saved);
      session.batchId = id;
      touchSession(session);
      if (!await persistForAcknowledgement(session, ack)) return;
      const summary = batchSummary(batches[id]);
      broadcastLobby(session);
      if (typeof ack === "function") ack({ ok: true, batchId: id, batch: summary, revision: saved.revision });
    } catch (error) {
      if (typeof ack === "function") ack({ ok: false, error: error.message, conflict: error.code === "REVISION_CONFLICT" });
    }
  }));
  socket.on("host:update-batch", hostOnly(socket, async (session, input, ack) => {
    if (session.phase !== "lobby" || !session.batchId || !input || input.id !== session.batchId) {
      if (typeof ack === "function") ack({ ok: false, error: "Select the batch you want to update in the lobby." });
      return;
    }
    const current = batches[session.batchId];
    if (!current || (current.brand || "github") !== session.brand || !batchVisibleTo(current, session.ownerUserId)) {
      if (typeof ack === "function") ack({ ok: false, error: "The selected batch is unavailable." });
      return;
    }
    if (Object.hasOwn(BATCHES, session.batchId) || current.ownerUserId !== session.ownerUserId) {
      if (typeof ack === "function") ack({ ok: false, error: "Shared batches are read-only. Save a new copy to customize one." });
      return;
    }
    try {
      validateBatchPayload(input);
      const updated = normalizeBatch({ ...input, id: session.batchId, brand: session.brand }, {
        path: "batch",
        existingIds: Object.keys(batches).filter(id => id !== session.batchId)
      });
      const existing = await batchRepository.getBatch(session.batchId);
      const expectedRevision = resolveExpectedRevision(input, existing, session.batchId);
      const hostUserId = session.ownerUserId;
      const saved = existing
        ? await batchRepository.updateBatch(session.batchId, updated, {
          state: "active",
          expectedRevision,
          ownerUserId: hostUserId,
          updatedBy: hostUserId,
        })
        : await batchRepository.createBatch(updated, { state: "active", source: "builtin-override", ownerUserId: hostUserId, updatedBy: hostUserId });
      batches[session.batchId] = persistedBatch(saved);
      touchSession(session);
      if (!await persistForAcknowledgement(session, ack)) return;
      const summary = batchSummary(batches[session.batchId]);
      broadcastLobby(session);
      if (typeof ack === "function") ack({ ok: true, batchId: session.batchId, batch: summary, revision: saved.revision });
    } catch (error) {
      if (typeof ack === "function") ack({ ok: false, error: error.message, conflict: error.code === "REVISION_CONFLICT" || error.code === "BATCH_OWNER_MISMATCH" });
    }
  }));
  socket.on("host:set-duration", hostOnly(socket, async (session, duration, ack) => {
    if (session.phase !== "lobby" || !Number.isInteger(duration) || duration < 10 || duration > 120) {
      if (typeof ack === "function") ack({ ok: false, error: "Set 10 to 120 whole seconds in the lobby." });
      return;
    }
    session.duration = duration;
    touchSession(session);
    if (!await persistForAcknowledgement(session, ack)) return;
    broadcastLobby(session);
    if (typeof ack === "function") ack({ ok: true, duration });
  }));
  socket.on("host:set-visibility", hostOnly(socket, async (session, policy, ack) => {
    if (session.phase !== "lobby") {
      if (typeof ack === "function") ack({ ok: false, error: "Set player visibility only from the lobby." });
      return;
    }
    session.visibility = normalizeVisibilityPolicy(policy);
    touchSession(session);
    if (!await persistForAcknowledgement(session, ack)) return;
    broadcastLobby(session);
    if (typeof ack === "function") ack({ ok: true, visibility: normalizeVisibilityPolicy(session.visibility) });
  }));
  socket.on("host:start", hostOnly(socket, async (session, ack) => {
    if (session.phase !== "lobby" || !session.batchId || !Object.keys(session.players).length) {
      if (typeof ack === "function") ack({ ok: false, error: "Select a batch and wait for a player." });
      return;
    }
    nextQuestion(session);
    if (!await persistForAcknowledgement(session, ack)) return;
    if (typeof ack === "function") ack({ ok: true });
  }));
  socket.on("host:next", hostOnly(socket, (session) => {
    if (session.phase === "reveal") {
      if (session.qIndex + 1 >= questions(session).length) endGame(session);
      else nextQuestion(session);
    }
  }));
  socket.on("host:skip", hostOnly(socket, (session) => {
    if (session.phase === "question") revealAnswer(session);
  }));
  socket.on("host:restart", hostOnly(socket, (session) => {
    resetGame(session);
  }));

  socket.on("player:answer", async (optIndex, cb) => {
    const session = activeSession(socket.data.sessionId);
    const playerId = socket.data.playerId;
    const p = session?.players[playerId];
    if (!session || !p || session.phase !== "question" || p.answered || !Number.isInteger(optIndex)
      || optIndex < 0 || optIndex >= questions(session)[session.qIndex].o.length) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    p.answered = true;
    session.answers[playerId] = optIndex;
    const q = questions(session)[session.qIndex];
    const correct = optIndex === q.c;
    const elapsed = (Date.now() - session.qStart) / 1000;
    const timeBonus = Math.max(0, Math.round((1 - elapsed / session.duration) * 100));
    let gained = 0;
    if (correct) {
      p.streak++; p.best = Math.max(p.best, p.streak);
      gained = 100 + timeBonus + (p.streak - 1) * 20;
      p.score += gained; p.lastCorrect = true;
    } else { p.streak = 0; p.lastCorrect = false; }
    touchSession(session);
    const answeredCount = Object.values(session.players).filter(x => x.answered).length;
    io.to(hostRoom(session.id)).emit("answered", {
      answered: answeredCount,
      total: Object.keys(session.players).length
    });
    if (answeredCount > 0 && answeredCount === Object.keys(session.players).length) revealAnswer(session);
    if (!await persistForAcknowledgement(session, cb)) return;
    if (typeof cb === "function") cb({ ok: true, correct, gained });
  });

  socket.on("disconnect", () => {
    const session = activeSession(socket.data.sessionId);
    if (socket.data.isHost && socket.data.sessionId) {
      const hostSockets = hostSocketsBySession.get(socket.data.sessionId);
      hostSockets?.delete(socket.id);
      if (hostSockets && !hostSockets.size) hostSocketsBySession.delete(socket.data.sessionId);
      if (session) {
        session.hostLastSeenAt = Date.now();
        recordActivity({
          category: "auth", action: "host.disconnect", outcome: "success", actorType: "host",
          actorId: session.ownerUserId, sessionId: session.id, details: { email: session.hostEmail },
        });
      }
      notifyAdmins("host");
    }
    const playerId = socket.data.playerId;
    const player = session?.players[playerId];
    if (player && player.socketId === socket.id) {
      player.connected = false;
      player.socketId = null;
      player.lastSeenAt = Date.now();
      persistInBackground(session);
      broadcastLobby(session);
      recordActivity({
        category: "participant", action: "participant.disconnect", outcome: "success", actorType: "player",
        sessionId: session.id, participantId: playerId, participantName: player.name,
      });
      notifyAdmins("participant");
    }
  });
});

function nextQuestion(session) {
  session.qIndex++;
  session.phase = "question";
  session.answers = {};
  session.reveal = null;
  session.qStart = Date.now();
  session.qEnd = session.qStart + session.duration * 1000;
  for (const p of Object.values(session.players)) p.answered = false;
  touchSession(session);
  const pub = publicQuestion(session);
  io.to(hostRoom(session.id)).emit("question", pub);
  for (const [playerId, player] of Object.entries(session.players)) {
    io.to(playerRoom(session.id, playerId)).emit("question", playerQuestion(session, player));
  }
  clearTimeout(session.timer);
  session.timer = setTimeout(() => revealAnswer(session), session.duration * 1000);
  persistInBackground(session);
  recordActivity({
    category: "session", action: "session.question-started", outcome: "success", actorType: "host",
    actorId: session.ownerUserId, sessionId: session.id,
    details: { questionNumber: session.qIndex + 1, totalQuestions: questions(session).length },
  });
  notifyAdmins("session");
}

function revealAnswer(session) {
  if (session.phase !== "question") return;
  clearTimeout(session.timer);
  session.timer = null;
  session.phase = "reveal";
  session.reveal = currentReveal(session);
  touchSession(session);
  io.to(hostRoom(session.id)).emit("reveal", session.reveal);
  for (const [id, p] of Object.entries(session.players)) {
    io.to(playerRoom(session.id, id)).emit("reveal", playerReveal(session, id, p));
  }
  persistInBackground(session);
  recordActivity({
    category: "session", action: "session.answer-revealed", outcome: "success", actorType: "system",
    sessionId: session.id, details: { questionNumber: session.qIndex + 1 },
  });
  notifyAdmins("session");
}

function endGame(session) {
  session.phase = "end";
  const lb = leaderboard(session);
  session.end = { brand: session.brand, podium: lb.slice(0, 3), leaderboard: lb.slice(0, 10) };
  touchSession(session);
  io.to(hostRoom(session.id)).emit("end", session.end);
  lb.forEach(row => io.to(playerRoom(session.id, row.id))
    .emit("end", playerEnd(session, row.id, session.players[row.id])));
  persistInBackground(session);
  recordActivity({
    category: "session", action: "session.ended", outcome: "success", actorType: "system",
    sessionId: session.id, details: { participants: lb.length },
  });
  notifyAdmins("session");
}

function resetGame(session, options = {}) {
  clearTimeout(session.timer);
  session.phase = "lobby"; session.batchId = null; session.duration = 20; session.qIndex = -1;
  session.timer = null;
  session.qEnd = 0; session.answers = {}; session.reveal = null; session.end = null;
  for (const [playerId, p] of Object.entries(session.players)) {
    if (!p.connected) {
      delete session.players[playerId];
      continue;
    }
    p.score = 0; p.streak = 0; p.best = 0; p.answered = false; p.lastCorrect = false;
  }
  touchSession(session);
  io.to(audienceRoom(session.id)).emit("public:brand", { brand: session.brand });
  io.to(audienceRoom(session.id)).emit("reset", {
    phase: session.phase,
    brand: session.brand,
    batchId: session.batchId,
    duration: session.duration
  });
  broadcastLobby(session);
  persistInBackground(session);
  if (options.log !== false) {
    recordActivity({
      category: "session", action: "session.reset", outcome: "success", actorType: "host",
      actorId: session.ownerUserId, sessionId: session.id,
    });
  }
  notifyAdmins("session");
}

async function adminResetSession(sessionId) {
  const session = activeSession(sessionId);
  if (!session) return null;
  resetGame(session, { log: false });
  await persistSession(session);
  return session;
}

async function expireQuizSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || expiringSessionIds.has(sessionId)) return false;
  expiringSessionIds.add(sessionId);
  clearTimeout(session.timer);
  const pending = sessionPendingPersists.get(sessionId);
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve();
    sessionPendingPersists.delete(sessionId);
  }
  const outstandingSaves = sessionSaveChains.get(sessionId);
  if (outstandingSaves) {
    try {
      await outstandingSaves;
    } catch (error) {
      console.error("Could not finish queued session persistence before expiry.", error);
    }
  }
  try {
    await sessionRepository.deleteSession(sessionId);
  } catch (error) {
    expiringSessionIds.delete(sessionId);
    if (session.phase === "question" && Number.isFinite(session.questionStartedAt)) {
      const remaining = Math.max(1, session.duration * 1000 - (Date.now() - session.questionStartedAt));
      session.timer = setTimeout(() => revealAnswer(session), remaining);
    }
    throw error;
  }
  sessions.delete(sessionId);
  hostSocketsBySession.delete(sessionId);
  sessionSaveChains.delete(sessionId);
  io.to(audienceRoom(sessionId)).emit("session:expired");
  io.in(audienceRoom(sessionId)).disconnectSockets(true);
  notifyAdmins("session");
  return true;
}

async function adminDisconnectParticipant(sessionId, participantId) {
  const session = activeSession(sessionId);
  const player = session?.players[participantId];
  if (!session || !player || !player.connected || !player.socketId) return null;
  const socket = io.sockets.sockets.get(player.socketId);
  player.connected = false;
  player.socketId = null;
  player.lastSeenAt = Date.now();
  if (socket) {
    socket.emit("admin:disconnected");
    socket.disconnect(true);
  }
  touchSession(session);
  await persistSession(session);
  broadcastLobby(session);
  notifyAdmins("participant");
  return { name: player.name };
}

async function startServer() {
  await accessCodeRepository.initialize();
  await auditRepository.initialize();
  await batchRepository.initialize();
  await feedbackRepository.initialize();
  await hostDomainRepository.initialize();
  await sessionRepository.initialize();
  const hostDomainSettings = await hostDomainRepository.getSettings();
  setPartnerHostDomains(hostDomainSettings.partnerDomains);
  adminControlPlane = createAdminControlPlane({
    app,
    io,
    env: process.env,
    auditRepository,
    accessCodeRepository,
    feedbackRepository,
    hostDomainRepository,
    runtime: {
      sessions,
      isHostConnected,
      publicBaseUrl: () => publicBaseUrl || `http://localhost:${server.address()?.port || PORT}`,
      batchLabel: batchId => batches[batchId]?.label || null,
      questionCount: session => session.batchId && batches[session.batchId] ? batches[session.batchId].questions.length : 0,
      normalizeHostEmail,
      hostDomainAllowed,
      protectedHostDomains: [...DEFAULT_ALLOWED_HOST_DOMAINS],
      getAllowedHostDomains,
      setPartnerHostDomains,
      hostIdentityFromEmail,
      resetSession: adminResetSession,
      expireSession: expireQuizSession,
      disconnectParticipant: adminDisconnectParticipant,
    },
  });
  const persisted = await batchRepository.listActiveBatches();
  for (const stored of persisted) {
    const batch = persistedBatch(stored);
    batches[batch.id] = batch;
  }
  const now = Date.now();
  for (const stored of await sessionRepository.listSessions()) {
    if (!stored || !validSessionId(stored.id) || stored.expiresAt <= now) {
      if (stored?.id) await sessionRepository.deleteSession(stored.id);
      continue;
    }
    const session = hydrateSession(stored);
    if (session.batchId && !batches[session.batchId]) session.batchId = null;
    sessions.set(session.id, session);
    if (session.phase === "question") {
      const remaining = session.qEnd - now;
      if (remaining <= 0) revealAnswer(session);
      else session.timer = setTimeout(() => revealAnswer(session), remaining);
    }
  }
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt > cutoff) continue;
      void expireQuizSession(id).then(expired => {
        if (!expired) return;
        recordActivity({
          category: "session", action: "session.expired", outcome: "success", actorType: "system",
          sessionId: id, details: { reason: "inactivity" },
        });
      }).catch(error => {
        console.error("Could not delete expired quiz session.", { sessionId: id, message: error.message });
      });
    }
  }, Math.min(60000, Math.max(1000, Math.floor(quizSessionTtlMs / 4))));
  cleanupTimer.unref();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`GitHub Platform Challenge listening on port ${server.address().port}`);
  });
}

startServer().catch(error => {
  console.error("Could not initialize durable quiz storage.", error);
  process.exitCode = 1;
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const pending = [...sessionPendingPersists.values()];
  for (const entry of pending) clearTimeout(entry.timer);
  sessionPendingPersists.clear();
  try {
    await Promise.all([...sessions.values()].map(session => persistSession(session)));
    pending.forEach(entry => entry.resolve());
  } catch (error) {
    pending.forEach(entry => entry.reject(error));
    console.error("Could not flush quiz sessions during shutdown.", error);
  }
  server.close(() => process.exit(0));
  const forcedExit = setTimeout(() => process.exit(1), 5000);
  forcedExit.unref();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
