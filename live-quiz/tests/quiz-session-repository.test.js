'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  FileQuizSessionRepository,
  MemoryQuizSessionRepository,
} = require('../repositories/quiz-session-repository');

function sampleSession(id = 'session_abcdefghijklmnop') {
  return {
    id,
    ownerUserId: 'host:owner',
    hostEmail: 'host@microsoft.com',
    hostResumeTokenHash: 'a'.repeat(64),
    phase: 'lobby',
    brand: 'github',
    batchId: null,
    qIndex: -1,
    players: {},
    answers: {},
    qStart: 0,
    qEnd: 0,
    duration: 20,
    reveal: null,
    end: null,
    createdAt: 100,
    lastActivityAt: 100,
    expiresAt: 200,
  };
}

test('memory session repository clones saved state and deletes by session id', async () => {
  const repository = new MemoryQuizSessionRepository();
  const session = sampleSession();
  await repository.saveSession(session);
  session.brand = 'microsoft';
  assert.equal((await repository.getSession(session.id)).brand, 'github');
  assert.equal((await repository.listSessions()).length, 1);
  await repository.deleteSession(session.id);
  assert.equal(await repository.getSession(session.id), null);
});

test('file session repository restores durable session state', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'live-quiz-session-test-'));
  const filePath = path.join(directory, 'sessions.json');
  try {
    const writer = new FileQuizSessionRepository(filePath);
    await writer.initialize();
    const session = sampleSession();
    session.players.player1 = {
      name: 'Player',
      score: 240,
      reconnectTokenHash: 'b'.repeat(64),
      connected: false,
      socketId: null,
    };
    await writer.saveSession(session);

    const reader = new FileQuizSessionRepository(filePath);
    await reader.initialize();
    const restored = await reader.getSession(session.id);
    assert.equal(restored.ownerUserId, 'host:owner');
    assert.equal(restored.players.player1.score, 240);
    assert.equal(restored.hostResumeTokenHash, 'a'.repeat(64));
    assert.equal(JSON.stringify(restored).includes('host-resume-token'), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
