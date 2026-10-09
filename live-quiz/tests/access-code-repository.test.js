'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  FileAccessCodeRepository,
  MemoryAccessCodeRepository,
} = require('../repositories/access-code-repository');

function sampleCode(digest = 'digest-one') {
  return {
    hostIdentity: ' Host@Example.COM ',
    digest,
    salt: 'salt-value',
    expiresAt: '2026-10-05T20:00:00.000Z',
    attempts: 0,
    redeemedAt: null,
    plaintextCode: '123456',
  };
}

function testDirectory(prefix) {
  return path.join(__dirname, `.${prefix}-${process.pid}-${randomUUID()}`);
}

test('memory access code repository clones metadata and keeps one normalized active code', async () => {
  const repository = new MemoryAccessCodeRepository();
  const code = sampleCode();
  const saved = await repository.save(code);
  code.digest = 'changed';
  saved.salt = 'changed';

  const restored = await repository.get('HOST@example.com');
  assert.equal(restored.hostIdentity, 'host@example.com');
  assert.equal(restored.digest, 'digest-one');
  assert.equal(restored.salt, 'salt-value');
  assert.equal(restored.expiresAt, '2026-10-05T20:00:00.000Z');
  assert.equal(restored.attempts, 0);
  assert.equal(restored.redeemedAt, null);
  assert.equal(restored.revision, 1);
  assert.equal(restored.maxAttempts, 5);
  assert.equal(typeof restored.createdAt, 'string');

  const replacement = await repository.save('host@example.com', sampleCode('digest-two'));
  assert.equal(replacement.revision, 2);
  assert.equal((await repository.get(' host@example.com ')).digest, 'digest-two');
  assert.equal(JSON.stringify(await repository.get('host@example.com')).includes('123456'), false);
});

test('access codes list active records and update with optimistic concurrency', async () => {
  const repository = new MemoryAccessCodeRepository();
  const current = await repository.save(sampleCode());
  await repository.save({
    ...sampleCode('expired'),
    hostIdentity: 'expired@example.com',
    expiresAt: '2026-10-05T18:00:00.000Z',
  });

  const active = await repository.listCodes({ now: '2026-10-05T19:00:00.000Z' });
  assert.deepEqual(active.map(code => code.hostIdentity), ['host@example.com']);
  active[0].attempts = 99;

  const updated = await repository.updateCode(
    'HOST@example.com',
    { attempts: 3, plaintextCode: 'must-not-persist' },
    { expectedRevision: current.revision },
  );
  assert.equal(updated.attempts, 3);
  assert.equal(updated.revision, 2);
  assert.equal(JSON.stringify(updated).includes('must-not-persist'), false);
  await assert.rejects(
    repository.updateCode('host@example.com', { attempts: 4 }, { expectedRevision: 1 }),
    error => error.code === 'REVISION_CONFLICT',
  );
  assert.equal((await repository.get('host@example.com')).attempts, 3);
});

test('access codes are single-use and failed attempts are retained', async () => {
  const repository = new MemoryAccessCodeRepository();
  await repository.save(sampleCode());

  assert.equal(await repository.consume('host@example.com', 'wrong', '2026-10-05T19:00:00.000Z'), null);
  assert.equal((await repository.get('host@example.com')).attempts, 1);
  const redeemed = await repository.consume('host@example.com', 'digest-one', '2026-10-05T19:01:00.000Z');
  assert.equal(redeemed.redeemedAt, '2026-10-05T19:01:00.000Z');
  assert.equal(redeemed.attempts, 2);
  assert.equal(await repository.consume('host@example.com', 'digest-one', '2026-10-05T19:02:00.000Z'), null);
});

test('file access code repository restores updates, redemption, and deletion', async () => {
  const directory = testDirectory('access-codes');
  const filePath = path.join(directory, 'codes.json');
  try {
    const writer = new FileAccessCodeRepository(filePath);
    await writer.initialize();
    await writer.save(sampleCode());
    await writer.save(sampleCode('replacement'));
    await writer.consume('HOST@EXAMPLE.COM', 'replacement', '2026-10-05T19:05:00.000Z');

    const reader = new FileAccessCodeRepository(filePath);
    await reader.initialize();
    const restored = await reader.get('host@example.com');
    assert.equal(restored.digest, 'replacement');
    assert.equal(restored.attempts, 1);
    assert.equal(restored.redeemedAt, '2026-10-05T19:05:00.000Z');
    assert.equal(restored.revision, 3);
    assert.equal(await reader.delete('HOST@example.com'), true);

    const afterDelete = new FileAccessCodeRepository(filePath);
    await afterDelete.initialize();
    assert.equal(await afterDelete.get('host@example.com'), null);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
