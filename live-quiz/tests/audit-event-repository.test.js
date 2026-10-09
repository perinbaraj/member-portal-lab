'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  FileAuditEventRepository,
  MemoryAuditEventRepository,
  RETENTION_SECONDS,
} = require('../repositories/audit-event-repository');

function sampleEvent(id, createdAt = '2026-10-05T12:00:00.000Z') {
  return {
    id,
    eventType: 'host.login',
    actorId: 'host:owner',
    sessionId: 'session_abcdefghijklmnop',
    outcome: 'success',
    details: { method: 'manual-code' },
    createdAt,
  };
}

function testDirectory(prefix) {
  return path.join(__dirname, `.${prefix}-${process.pid}-${randomUUID()}`);
}

test('memory audit event repository clones values and paginates filtered events', async () => {
  const repository = new MemoryAuditEventRepository();
  const event = sampleEvent('event-1');
  await repository.createEvent(event);
  event.details.method = 'changed';
  await repository.createEvent({ ...sampleEvent('event-2', '2026-10-05T12:01:00.000Z'), outcome: 'denied' });

  const firstPage = await repository.listEvents({ eventType: 'host.login', limit: 1 });
  assert.equal(firstPage.events.length, 1);
  assert.equal(firstPage.events[0].id, 'event-2');
  assert.equal(firstPage.events[0].ttl, RETENTION_SECONDS);
  firstPage.events[0].details.method = 'mutated';

  const secondPage = await repository.listEvents({ eventType: 'host.login', limit: 1, cursor: firstPage.nextCursor });
  assert.equal(secondPage.events[0].id, 'event-1');
  assert.equal(secondPage.events[0].details.method, 'manual-code');
  assert.equal(secondPage.nextCursor, null);
});

test('file audit event repository restores events and removes records older than 90 days', async () => {
  const directory = testDirectory('audit-events');
  const filePath = path.join(directory, 'events.json');
  try {
    const writer = new FileAuditEventRepository(filePath);
    await writer.initialize();
    await writer.createEvent(sampleEvent('expired', '2026-01-01T00:00:00.000Z'));
    await writer.createEvent(sampleEvent('retained', '2026-09-01T00:00:00.000Z'));
    assert.equal(await writer.cleanupExpiredEvents('2026-10-05T00:00:00.000Z'), 1);

    const reader = new FileAuditEventRepository(filePath);
    await reader.initialize();
    const restored = await reader.listEvents();
    assert.deepEqual(restored.events.map(event => event.id), ['retained']);
    assert.equal(restored.events[0].expiresAt, '2026-11-30T00:00:00.000Z');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
