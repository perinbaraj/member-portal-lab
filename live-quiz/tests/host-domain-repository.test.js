'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  FileHostDomainRepository,
  MemoryHostDomainRepository,
  normalizeDomain,
} = require('../repositories/host-domain-repository');

test('normalizes valid domains and rejects addresses, wildcards, and malformed labels', () => {
  assert.equal(normalizeDomain(' Partner.Example.COM '), 'partner.example.com');
  for (const value of ['user@partner.com', '*.partner.com', 'https://partner.com', '-bad.com', 'localhost']) {
    assert.throws(() => normalizeDomain(value), /valid email domain/i);
  }
});

test('memory host-domain repository adds and removes normalized domains', async () => {
  const repository = new MemoryHostDomainRepository(['seed.example']);
  assert.deepEqual((await repository.getSettings()).partnerDomains, ['seed.example']);
  const added = await repository.addDomain('Partner.COM', { updatedBy: 'Admin' });
  assert.deepEqual(added.partnerDomains, ['partner.com', 'seed.example']);
  assert.equal(added.updatedBy, 'Admin');
  await assert.rejects(repository.addDomain('partner.com'), /already an allowed partner domain/i);
  assert.equal(await repository.removeDomain('missing.example'), null);
  assert.deepEqual((await repository.removeDomain('partner.com')).partnerDomains, ['seed.example']);
});

test('file host-domain repository persists an intentionally empty partner list', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'live-quiz-domains-'));
  const filePath = path.join(directory, 'domains.json');
  try {
    const writer = new FileHostDomainRepository(filePath, ['seed.example']);
    await writer.initialize();
    await writer.removeDomain('seed.example', { updatedBy: 'Admin' });

    const reader = new FileHostDomainRepository(filePath, ['seed.example']);
    await reader.initialize();
    assert.deepEqual((await reader.getSettings()).partnerDomains, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
