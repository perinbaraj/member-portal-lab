'use strict';

const { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } = require('node:crypto');

const COOKIE_NAME = 'live_quiz_admin';
const ADMIN_ROOM = 'live-quiz:admins';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const EXPORT_LIMIT = 5000;
const SENSITIVE_KEY = /secret|token|passphrase|password|cookie|csrf|digest|salt|otp|code|answer|socket/i;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left || '') || !/^[a-f0-9]{64}$/.test(right || '')) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function integerSetting(env, name, fallback, minimum, maximum) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function parseCookies(header) {
  const result = {};
  for (const part of String(header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    try { result[key] = decodeURIComponent(part.slice(separator + 1).trim()); } catch {}
  }
  return result;
}

function cleanDetails(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map(item => cleanDetails(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 500);
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    if (SENSITIVE_KEY.test(key)) continue;
    result[key] = cleanDetails(item, depth + 1);
  }
  return result;
}

function queryItems(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

function normalizeOperatorName(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} .,'_-]{2,80}$/u.test(normalized) ? normalized : '';
}

function pageRequest(query) {
  const page = /^\d+$/.test(String(query.page || '')) ? Math.max(1, Number(query.page)) : 1;
  const pageSize = /^\d+$/.test(String(query.pageSize || ''))
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize))) : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

function paginate(items, query) {
  const { page, pageSize } = pageRequest(query);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(items) {
  if (!items.length) return '';
  const headers = [...new Set(items.flatMap(item => Object.keys(item)))];
  return [headers.map(csvCell).join(','), ...items.map(item => headers.map(key => csvCell(item[key])).join(','))].join('\r\n');
}

function createAdminControlPlane(options) {
  const {
    app, io, env, auditRepository, accessCodeRepository, feedbackRepository, hostDomainRepository, runtime,
  } = options;
  const configuredPassphrase = env.ADMIN_PASSPHRASE;
  const adminEnabled = typeof configuredPassphrase === 'string' && configuredPassphrase.length > 0;
  if (adminEnabled) {
    const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(pattern => pattern.test(configuredPassphrase)).length;
    if (configuredPassphrase.length < 20 || configuredPassphrase.length > 1024 || groups < 3) {
      throw new Error('ADMIN_PASSPHRASE must be 20–1024 characters with at least three character classes.');
    }
  }
  const adminPassphraseHash = adminEnabled ? hash(configuredPassphrase) : null;
  const sessionTtlMs = integerSetting(env, 'ADMIN_SESSION_TTL_SECONDS', 28800, 300, 86400) * 1000;
  const loginWindowMs = integerSetting(env, 'ADMIN_LOGIN_RATE_WINDOW_SECONDS', 900, 60, 86400) * 1000;
  const loginAttemptLimit = integerSetting(env, 'ADMIN_LOGIN_ATTEMPT_LIMIT', 5, 1, 50);
  const accessCodeTtlMs = integerSetting(env, 'ADMIN_HOST_CODE_TTL_SECONDS', 600, 60, 3600) * 1000;
  const accessCodeMaxAttempts = integerSetting(env, 'ADMIN_HOST_CODE_MAX_ATTEMPTS', 5, 1, 20);
  function normalizeAccessCodeTtlMs(input) {
    if (input === undefined || input === null || input === '') return accessCodeTtlMs;
    const minutes = Number(input);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      throw new Error('Access code expiration must be between 1 and 1440 whole minutes.');
    }
    return minutes * 60000;
  }
  const auditRetentionSeconds = integerSetting(env, 'ADMIN_AUDIT_RETENTION_DAYS', 90, 1, 365) * 86400;
  const sessions = new Map();
  const loginAttempts = new Map();
  const manualCodeVerificationChains = new Map();
  let updateTimer = null;
  let updateRevision = 0;

  function cookieValue(token, maxAgeSeconds) {
    const secure = env.NODE_ENV === 'production' || /^https:/.test(env.PUBLIC_BASE_URL || '');
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
  }

  function requestSession(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token || token.length > 256) return null;
    const tokenHash = hash(token);
    const session = sessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) sessions.delete(tokenHash);
      return null;
    }
    return { ...session, tokenHash };
  }

  function socketSession(socket) {
    const token = parseCookies(socket.handshake.headers.cookie)[COOKIE_NAME];
    if (!token || token.length > 256) return null;
    const tokenHash = hash(token);
    const session = sessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) return null;
    return { ...session, tokenHash };
  }

  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    const expected = env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    try { return new URL(origin).origin === new URL(expected).origin; } catch { return false; }
  }

  function adminRequired(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!adminEnabled) return res.status(503).json({ error: 'The admin dashboard is not configured.' });
    const session = requestSession(req);
    if (!session) return res.status(401).json({ error: 'Admin authentication is required.' });
    req.adminSession = session;
    return next();
  }

  function adminWriteRequired(req, res, next) {
    return adminRequired(req, res, () => {
      if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin admin requests are not allowed.' });
      const candidate = typeof req.headers['x-admin-csrf'] === 'string' ? hash(req.headers['x-admin-csrf']) : '';
      if (!safeEqualHex(candidate, req.adminSession.csrfHash)) {
        return res.status(403).json({ error: 'The admin request token is invalid. Refresh and sign in again.' });
      }
      return next();
    });
  }

  async function recordEvent(event) {
    const createdAt = event.createdAt || new Date().toISOString();
    const document = {
      id: event.id || randomUUID(),
      category: String(event.category || 'system').slice(0, 40),
      action: String(event.action || 'unknown').slice(0, 100),
      outcome: String(event.outcome || 'success').slice(0, 30),
      actorType: String(event.actorType || 'system').slice(0, 30),
      actorId: event.actorId ? String(event.actorId).slice(0, 254) : null,
      operatorName: event.operatorName ? normalizeOperatorName(event.operatorName) || String(event.operatorName).slice(0, 80) : null,
      sessionId: event.sessionId ? String(event.sessionId).slice(0, 64) : null,
      participantId: event.participantId ? String(event.participantId).slice(0, 64) : null,
      participantName: event.participantName ? String(event.participantName).slice(0, 20) : null,
      details: cleanDetails(event.details || {}),
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + auditRetentionSeconds * 1000).toISOString(),
      ttl: auditRetentionSeconds,
    };
    const serialized = JSON.stringify(document);
    if (Buffer.byteLength(serialized, 'utf8') > 16 * 1024) document.details = { truncated: true };
    const stored = await auditRepository.createEvent(document);
    scheduleBroadcast('event');
    return stored;
  }

  function recordEventInBackground(event) {
    void recordEvent(event).catch(error => {
      console.error('Could not persist admin activity event.', { action: event.action, message: error.message });
    });
  }

  function scheduleBroadcast(reason = 'state') {
    if (!adminEnabled || updateTimer) return;
    updateTimer = setTimeout(() => {
      updateTimer = null;
      updateRevision += 1;
      io.to(ADMIN_ROOM).emit('admin:update', { revision: updateRevision, reason, at: new Date().toISOString() });
    }, 75);
    updateTimer.unref();
  }

  function hostProjections() {
    const hosts = new Map();
    for (const session of runtime.sessions.values()) {
      let host = hosts.get(session.ownerUserId);
      if (!host) {
        host = {
          hostId: session.ownerUserId,
          email: session.hostEmail || null,
          connected: false,
          sessionCount: 0,
          phases: new Set(),
          lastActivityAt: 0,
        };
        hosts.set(session.ownerUserId, host);
      }
      host.connected ||= runtime.isHostConnected(session.id);
      host.sessionCount += 1;
      host.phases.add(session.phase);
      host.lastActivityAt = Math.max(host.lastActivityAt, session.lastActivityAt || session.createdAt || 0);
    }
    return [...hosts.values()].map(host => ({
      ...host,
      phases: [...host.phases],
      lastActivityAt: host.lastActivityAt ? new Date(host.lastActivityAt).toISOString() : null,
    })).sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)));
  }

  function sessionProjection(session) {
    const players = Object.values(session.players || {});
    const base = runtime.publicBaseUrl();
    return {
      id: session.id,
      hostId: session.ownerUserId,
      hostEmail: session.hostEmail || null,
      hostConnected: runtime.isHostConnected(session.id),
      brand: session.brand,
      batchId: session.batchId || null,
      batchLabel: runtime.batchLabel(session.batchId),
      phase: session.phase,
      duration: session.duration,
      questionIndex: session.qIndex,
      questionNumber: session.qIndex >= 0 ? session.qIndex + 1 : 0,
      totalQuestions: runtime.questionCount(session),
      connectedParticipants: players.filter(player => player.connected).length,
      totalParticipants: players.length,
      answeredCount: Object.keys(session.answers || {}).length,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActivityAt: new Date(session.lastActivityAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      joinUrl: `${base}/play?session=${encodeURIComponent(session.id)}`,
    };
  }

  function sessionProjections() {
    return [...runtime.sessions.values()].map(sessionProjection)
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }

  function participantProjection(session, id, player) {
    return {
      id,
      sessionId: session.id,
      hostEmail: session.hostEmail || null,
      name: player.name,
      score: player.score || 0,
      connected: Boolean(player.connected),
      joinedAt: player.joinedAt ? new Date(player.joinedAt).toISOString() : new Date(session.createdAt).toISOString(),
      lastSeenAt: player.lastSeenAt ? new Date(player.lastSeenAt).toISOString() : new Date(session.lastActivityAt).toISOString(),
    };
  }

  function participantProjections() {
    return [...runtime.sessions.values()].flatMap(session => Object.entries(session.players || {})
      .map(([id, player]) => participantProjection(session, id, player)))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async function allEvents() {
    const events = [];
    let cursor = null;
    do {
      const page = await auditRepository.listEvents({ limit: Math.min(200, EXPORT_LIMIT - events.length), cursor });
      events.push(...queryItems(page));
      cursor = page?.nextCursor || page?.continuationToken || null;
    } while (cursor && events.length < EXPORT_LIMIT);
    return events.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function allFeedback() {
    return (await feedbackRepository.listFeedback()).map(item => ({
      ...item,
      status: item.status || 'new',
      internalNote: item.internalNote || '',
      revision: item.revision || 1,
    })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function allCodes() {
    if (typeof accessCodeRepository.listCodes !== 'function') return [];
    return queryItems(await accessCodeRepository.listCodes({ includeInactive: true }));
  }

  async function overview() {
    const hosts = hostProjections();
    const sessionItems = sessionProjections();
    const participants = participantProjections();
    const feedback = await allFeedback();
    const events = await allEvents();
    const codes = await allCodes();
    const oneDayAgo = Date.now() - 86400000;
    return {
      connectedHosts: hosts.filter(host => host.connected).length,
      knownHosts: hosts.length,
      activeSessions: sessionItems.length,
      sessionsByPhase: Object.fromEntries(['lobby', 'question', 'reveal', 'end'].map(phase => [phase, sessionItems.filter(item => item.phase === phase).length])),
      connectedParticipants: participants.filter(player => player.connected).length,
      totalParticipants: participants.length,
      newFeedback: feedback.filter(item => item.status === 'new').length,
      totalFeedback: feedback.length,
      activeAccessCodes: codes.filter(code => !code.redeemedAt && Date.parse(code.expiresAt) > Date.now()).length,
      recentIssues: events.filter(event => Date.parse(event.createdAt) >= oneDayAgo && ['failed', 'error', 'warning'].includes(event.outcome)).length,
      recentEvents: events.slice(0, 20).map(publicEvent),
    };
  }

  function publicEvent(event) {
    return {
      id: event.id,
      category: event.category,
      action: event.action,
      outcome: event.outcome,
      actorType: event.actorType,
      actorId: event.actorId,
      operatorName: event.operatorName,
      sessionId: event.sessionId,
      participantId: event.participantId,
      participantName: event.participantName,
      details: cleanDetails(event.details || {}),
      createdAt: event.createdAt,
    };
  }

  function search(items, term, fields) {
    const needle = String(term || '').trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => fields.some(field => String(item[field] || '').toLowerCase().includes(needle)));
  }

  function reasonFrom(req, res) {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 3 || reason.length > 300) {
      res.status(400).json({ error: 'Enter a reason using 3 to 300 characters.' });
      return null;
    }
    return reason;
  }

  const json = require('express').json({ limit: '24kb', type: 'application/json' });
  app.post('/api/admin/login', json, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!adminEnabled) return res.status(503).json({ error: 'The admin dashboard is not configured.' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin admin requests are not allowed.' });
    const operatorName = normalizeOperatorName(req.body?.operatorName);
    const passphrase = typeof req.body?.passphrase === 'string' && req.body.passphrase.length <= 1024 ? req.body.passphrase : '';
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = (loginAttempts.get(key) || []).filter(timestamp => timestamp > now - loginWindowMs);
    if (attempts.length >= loginAttemptLimit) {
      await recordEvent({ category: 'admin', action: 'admin.login', outcome: 'blocked', actorType: 'admin', operatorName: operatorName || null });
      return res.status(429).json({ error: 'Too many admin sign-in attempts. Try again later.' });
    }
    const candidateHash = passphrase ? hash(passphrase) : '';
    if (!operatorName || !safeEqualHex(candidateHash, adminPassphraseHash)) {
      attempts.push(now);
      loginAttempts.set(key, attempts);
      await recordEvent({ category: 'admin', action: 'admin.login', outcome: 'failed', actorType: 'admin', operatorName: operatorName || null });
      return res.status(401).json({ error: 'Invalid operator name or admin passphrase.' });
    }
    loginAttempts.delete(key);
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(32).toString('base64url');
    const expiresAt = now + sessionTtlMs;
    sessions.set(hash(token), { operatorName, csrfToken: csrf, csrfHash: hash(csrf), createdAt: now, expiresAt });
    res.set('Set-Cookie', cookieValue(token, Math.ceil(sessionTtlMs / 1000)));
    await recordEvent({ category: 'admin', action: 'admin.login', outcome: 'success', actorType: 'admin', operatorName });
    return res.json({ ok: true, operatorName, csrfToken: csrf, expiresAt });
  });

  app.get('/api/admin/me', adminRequired, (req, res) => {
    res.json({
      ok: true,
      operatorName: req.adminSession.operatorName,
      csrfToken: req.adminSession.csrfToken,
      expiresAt: req.adminSession.expiresAt,
    });
  });

  app.post('/api/admin/logout', adminWriteRequired, async (req, res) => {
    sessions.delete(req.adminSession.tokenHash);
    io.to(`admin-session:${req.adminSession.tokenHash}`).emit('admin:session-expired');
    res.set('Set-Cookie', cookieValue('', 0));
    await recordEvent({ category: 'admin', action: 'admin.logout', outcome: 'success', actorType: 'admin', operatorName: req.adminSession.operatorName });
    res.json({ ok: true });
  });

  app.get('/api/admin/overview', adminRequired, async (_req, res) => {
    try { res.json(await overview()); } catch (error) { res.status(500).json({ error: 'Could not load the admin overview.' }); }
  });

  app.get('/api/admin/host-domains', adminRequired, async (_req, res) => {
    try {
      const settings = await hostDomainRepository.getSettings();
      return res.json({
        protectedDomains: [...runtime.protectedHostDomains],
        partnerDomains: settings.partnerDomains,
        allowedDomains: runtime.getAllowedHostDomains(),
        revision: settings.revision,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      });
    } catch (error) {
      return res.status(500).json({ error: 'Could not load allowed host domains.' });
    }
  });

  app.post('/api/admin/host-domains', json, adminWriteRequired, async (req, res) => {
    const reason = reasonFrom(req, res);
    if (!reason) return;
    const domain = String(req.body?.domain || '').trim().toLowerCase();
    if (runtime.protectedHostDomains.includes(domain)) {
      return res.status(409).json({ error: `${domain} is already a protected host domain.` });
    }
    try {
      const settings = await hostDomainRepository.addDomain(domain, {
        updatedBy: req.adminSession.operatorName,
      });
      runtime.setPartnerHostDomains(settings.partnerDomains);
      await recordEvent({
        category: 'admin',
        action: 'host-domain.added',
        outcome: 'success',
        actorType: 'admin',
        operatorName: req.adminSession.operatorName,
        details: { domain, reason },
      });
      scheduleBroadcast('host-domain');
      return res.status(201).json({
        ok: true,
        domain,
        protectedDomains: [...runtime.protectedHostDomains],
        partnerDomains: settings.partnerDomains,
        allowedDomains: runtime.getAllowedHostDomains(),
        revision: settings.revision,
      });
    } catch (error) {
      if (error.code === 'DOMAIN_CONFLICT') return res.status(409).json({ error: error.message });
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Could not add the host domain.' });
    }
  });

  app.delete('/api/admin/host-domains/:domain', json, adminWriteRequired, async (req, res) => {
    const reason = reasonFrom(req, res);
    if (!reason) return;
    const domain = String(req.params.domain || '').trim().toLowerCase();
    if (runtime.protectedHostDomains.includes(domain)) {
      return res.status(409).json({ error: `${domain} is protected and cannot be removed.` });
    }
    try {
      const settings = await hostDomainRepository.removeDomain(domain, {
        updatedBy: req.adminSession.operatorName,
      });
      if (!settings) return res.status(404).json({ error: 'Partner host domain not found.' });
      runtime.setPartnerHostDomains(settings.partnerDomains);
      await recordEvent({
        category: 'admin',
        action: 'host-domain.removed',
        outcome: 'success',
        actorType: 'admin',
        operatorName: req.adminSession.operatorName,
        details: { domain, reason },
      });
      scheduleBroadcast('host-domain');
      return res.json({
        ok: true,
        domain,
        protectedDomains: [...runtime.protectedHostDomains],
        partnerDomains: settings.partnerDomains,
        allowedDomains: runtime.getAllowedHostDomains(),
        revision: settings.revision,
      });
    } catch (error) {
      if (error.code === 'DOMAIN_CONFLICT') return res.status(409).json({ error: error.message });
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Could not remove the host domain.' });
    }
  });

  app.get('/api/admin/hosts', adminRequired, (req, res) => {
    const items = search(hostProjections(), req.query.search, ['email', 'hostId']);
    res.json(paginate(items, req.query));
  });

  app.get('/api/admin/sessions', adminRequired, (req, res) => {
    let items = search(sessionProjections(), req.query.search, ['id', 'hostEmail', 'hostId', 'batchLabel']);
    if (req.query.phase) items = items.filter(item => item.phase === req.query.phase);
    res.json(paginate(items, req.query));
  });

  app.get('/api/admin/sessions/:sessionId', adminRequired, async (req, res) => {
    const session = runtime.sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Quiz session not found.' });
    const events = (await allEvents()).filter(event => event.sessionId === session.id).slice(0, 100).map(publicEvent);
    return res.json({
      session: sessionProjection(session),
      participants: Object.entries(session.players || {}).map(([id, player]) => participantProjection(session, id, player)),
      events,
    });
  });

  app.get('/api/admin/participants', adminRequired, (req, res) => {
    const items = search(participantProjections(), req.query.search, ['name', 'sessionId', 'hostEmail']);
    res.json(paginate(items, req.query));
  });

  app.get('/api/admin/logs', adminRequired, async (req, res) => {
    let items = (await allEvents()).map(publicEvent);
    if (req.query.category) items = items.filter(item => item.category === req.query.category);
    items = search(items, req.query.search, ['action', 'operatorName', 'actorId', 'participantName', 'sessionId', 'outcome']);
    res.json(paginate(items, req.query));
  });

  app.get('/api/admin/feedback', adminRequired, async (req, res) => {
    let items = await allFeedback();
    if (req.query.status) items = items.filter(item => item.status === req.query.status);
    items = search(items, req.query.search, ['category', 'comments', 'email', 'sessionId', 'status']);
    res.json(paginate(items, req.query));
  });

  app.patch('/api/admin/feedback/:feedbackId', json, adminWriteRequired, async (req, res) => {
    const status = req.body?.status;
    const internalNote = typeof req.body?.internalNote === 'string' ? req.body.internalNote.trim() : '';
    const expectedRevision = req.body?.expectedRevision;
    if (!['reviewed', 'resolved'].includes(status) || internalNote.length > 1000 || !Number.isInteger(expectedRevision)) {
      return res.status(400).json({ error: 'Choose reviewed or resolved, provide a valid revision, and keep the internal note under 1000 characters.' });
    }
    const now = new Date().toISOString();
    try {
      const updated = await feedbackRepository.updateFeedback(req.params.feedbackId, {
        status,
        internalNote,
        reviewedBy: req.adminSession.operatorName,
        reviewedAt: now,
        resolvedAt: status === 'resolved' ? now : null,
      }, { expectedRevision });
      if (!updated) return res.status(404).json({ error: 'Feedback not found.' });
      await recordEvent({
        category: 'feedback', action: `feedback.${status}`, outcome: 'success', actorType: 'admin',
        operatorName: req.adminSession.operatorName, sessionId: updated.sessionId,
        details: { feedbackId: updated.id, category: updated.category },
      });
      scheduleBroadcast('feedback');
      return res.json({ ok: true, feedback: updated });
    } catch (error) {
      if (error.code === 'REVISION_CONFLICT') return res.status(409).json({ error: error.message });
      return res.status(500).json({ error: 'Could not update feedback.' });
    }
  });

  app.post('/api/admin/access-codes', json, adminWriteRequired, async (req, res) => {
    const parsed = runtime.normalizeHostEmail(req.body?.email);
    const reason = reasonFrom(req, res);
    if (!reason) return;
    if (!parsed || !runtime.hostDomainAllowed(parsed.email)) {
      return res.status(400).json({ error: 'Use an exact work email address from an allowed domain.' });
    }
    let ttlMs;
    try {
      ttlMs = normalizeAccessCodeTtlMs(req.body?.expiresMinutes);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const identity = runtime.hostIdentityFromEmail(parsed.email);
    const id = randomUUID();
    const salt = randomBytes(16).toString('base64url');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = Date.now();
    const document = {
      id,
      hostIdentity: identity,
      email: parsed.email,
      salt,
      digest: hash(`${id}:${salt}:${code}`),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      attempts: 0,
      maxAttempts: accessCodeMaxAttempts,
      redeemedAt: null,
      createdBy: req.adminSession.operatorName,
      revision: 1,
    };
    await (accessCodeRepository.saveCode || accessCodeRepository.saveAccessCode || accessCodeRepository.save)
      .call(accessCodeRepository, document);
    await recordEvent({
      category: 'auth', action: 'manual-code.generated', outcome: 'success', actorType: 'admin',
      operatorName: req.adminSession.operatorName, actorId: identity,
      details: { email: parsed.email, expiresAt: document.expiresAt, reason, ttlMs },
    });
    scheduleBroadcast('access-code');
    return res.status(201).json({ ok: true, email: parsed.email, code, expiresAt: document.expiresAt, ttlMs });
  });

  app.post('/api/admin/sessions/:sessionId/reset', json, adminWriteRequired, async (req, res) => {
    const reason = reasonFrom(req, res); if (!reason) return;
    try {
      const session = await runtime.resetSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Quiz session not found.' });
      await recordEvent({ category: 'admin', action: 'session.reset', outcome: 'success', actorType: 'admin', operatorName: req.adminSession.operatorName, sessionId: session.id, details: { reason } });
      scheduleBroadcast('session');
      return res.json({ ok: true, session: sessionProjection(session) });
    } catch (error) { return res.status(409).json({ error: error.message || 'Could not reset the quiz session.' }); }
  });

  app.post('/api/admin/sessions/:sessionId/expire', json, adminWriteRequired, async (req, res) => {
    const reason = reasonFrom(req, res); if (!reason) return;
    const expired = await runtime.expireSession(req.params.sessionId);
    if (!expired) return res.status(404).json({ error: 'Quiz session not found.' });
    await recordEvent({ category: 'admin', action: 'session.expired', outcome: 'success', actorType: 'admin', operatorName: req.adminSession.operatorName, sessionId: req.params.sessionId, details: { reason } });
    scheduleBroadcast('session');
    return res.json({ ok: true });
  });

  app.post('/api/admin/sessions/:sessionId/participants/:participantId/disconnect', json, adminWriteRequired, async (req, res) => {
    const reason = reasonFrom(req, res); if (!reason) return;
    const result = await runtime.disconnectParticipant(req.params.sessionId, req.params.participantId);
    if (!result) return res.status(404).json({ error: 'Connected participant not found.' });
    await recordEvent({
      category: 'admin', action: 'participant.disconnected', outcome: 'success', actorType: 'admin',
      operatorName: req.adminSession.operatorName, sessionId: req.params.sessionId,
      participantId: req.params.participantId, participantName: result.name, details: { reason },
    });
    scheduleBroadcast('participant');
    return res.json({ ok: true });
  });

  app.get('/api/admin/export', adminRequired, async (req, res) => {
    const resource = req.query.resource;
    const format = req.query.format;
    if (!['sessions', 'participants', 'logs', 'feedback'].includes(resource) || !['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Choose a valid export resource and format.' });
    }
    let items;
    if (resource === 'sessions') items = sessionProjections();
    if (resource === 'participants') items = participantProjections();
    if (resource === 'logs') items = (await allEvents()).map(publicEvent);
    if (resource === 'feedback') items = await allFeedback();
    items = items.slice(0, EXPORT_LIMIT).map(item => cleanDetails(item));
    await recordEvent({ category: 'export', action: 'admin.export', outcome: 'success', actorType: 'admin', operatorName: req.adminSession.operatorName, details: { resource, format, count: items.length } });
    const filename = `live-quiz-${resource}-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    if (format === 'json') return res.type('application/json').send(JSON.stringify(items, null, 2));
    return res.type('text/csv').send(toCsv(items));
  });

  app.use((error, req, res, next) => {
    if (!req.path.startsWith('/api/admin/')) return next(error);
    res.set('Cache-Control', 'no-store');
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Admin request payload is too large.' });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Admin request must be valid JSON.' });
    console.error('Unhandled admin API error.', { path: req.path, message: error?.message || String(error) });
    return res.status(500).json({ error: 'The admin request could not be completed.' });
  });

  async function verifyManualHostCodeUnlocked(parsed, code, identity) {
    const getCode = accessCodeRepository.getCode || accessCodeRepository.getAccessCode || accessCodeRepository.get;
    const deleteCode = accessCodeRepository.deleteCode || accessCodeRepository.deleteAccessCode || accessCodeRepository.delete;
    const current = await getCode.call(accessCodeRepository, identity);
    if (!current || current.redeemedAt || Date.parse(current.expiresAt) <= Date.now()) {
      if (current && deleteCode) await deleteCode.call(accessCodeRepository, identity);
      return { ok: false, error: 'The admin-provided code expired or was already used.' };
    }
    const attempts = (current.attempts || 0) + 1;
    const candidate = hash(`${current.id}:${current.salt}:${String(code).trim()}`);
    if (!safeEqualHex(candidate, current.digest)) {
      if (attempts >= (current.maxAttempts || accessCodeMaxAttempts)) {
        await deleteCode.call(accessCodeRepository, identity);
      } else {
        await accessCodeRepository.updateCode(identity, { attempts }, { expectedRevision: current.revision });
      }
      await recordEvent({ category: 'auth', action: 'manual-code.redeem', outcome: 'failed', actorType: 'host', actorId: identity, details: { email: parsed.email, attempts } });
      return { ok: false, error: attempts >= (current.maxAttempts || accessCodeMaxAttempts) ? 'Too many incorrect attempts. Ask an admin for a new code.' : 'Invalid or expired admin-provided code.' };
    }
    const redeemedAt = new Date().toISOString();
    await accessCodeRepository.updateCode(identity, { attempts, redeemedAt }, { expectedRevision: current.revision });
    await recordEvent({ category: 'auth', action: 'manual-code.redeem', outcome: 'success', actorType: 'host', actorId: identity, details: { email: parsed.email } });
    scheduleBroadcast('access-code');
    return { ok: true, email: parsed.email };
  }

  async function verifyManualHostCode(email, code) {
    const parsed = runtime.normalizeHostEmail(email);
    if (!parsed || !runtime.hostDomainAllowed(parsed.email) || !/^\d{6}$/.test(String(code || '').trim())) {
      return { ok: false, error: 'Invalid or expired admin-provided code.' };
    }
    const identity = runtime.hostIdentityFromEmail(parsed.email);
    const previous = manualCodeVerificationChains.get(identity) || Promise.resolve();
    const verification = previous.catch(() => {}).then(() => verifyManualHostCodeUnlocked(parsed, code, identity));
    const settled = verification.catch(() => {});
    manualCodeVerificationChains.set(identity, settled);
    try {
      return await verification;
    } finally {
      if (manualCodeVerificationChains.get(identity) === settled) manualCodeVerificationChains.delete(identity);
    }
  }

  io.on('connection', socket => {
    socket.on('admin:subscribe', (_input, ack) => {
      const session = socketSession(socket);
      if (!session) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Admin authentication is required.' });
        return;
      }
      socket.data.adminSessionHash = session.tokenHash;
      socket.join(ADMIN_ROOM);
      socket.join(`admin-session:${session.tokenHash}`);
      if (typeof ack === 'function') ack({ ok: true, revision: updateRevision });
    });
  });

  const pruneTimer = setInterval(() => {
    const now = Date.now();
    for (const [tokenHash, session] of sessions) {
      if (session.expiresAt > now) continue;
      sessions.delete(tokenHash);
      io.to(`admin-session:${tokenHash}`).emit('admin:session-expired');
    }
    const auditCleanup = auditRepository.deleteExpired || auditRepository.cleanupExpired || auditRepository.cleanupExpiredEvents;
    void auditCleanup?.call(auditRepository, new Date(now).toISOString()).catch(error => {
      console.error('Could not prune expired admin audit events.', { message: error.message });
    });
    void (async () => {
      const codes = await allCodes();
      const expired = codes.filter(code => Date.parse(code.expiresAt) <= now || code.redeemedAt);
      const remove = accessCodeRepository.deleteCode || accessCodeRepository.deleteAccessCode || accessCodeRepository.delete;
      if (remove) await Promise.all(expired.map(code => remove.call(accessCodeRepository, code.hostIdentity)));
    })().catch(error => console.error('Could not prune expired admin access codes.', { message: error.message }));
  }, 60000);
  pruneTimer.unref();

  return {
    adminEnabled,
    recordEvent,
    recordEventInBackground,
    scheduleBroadcast,
    verifyManualHostCode,
  };
}

module.exports = { createAdminControlPlane };
