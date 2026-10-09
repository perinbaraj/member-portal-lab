'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizeDomain(value) {
  const domain = String(value || '').trim().toLowerCase();
  if (!domain || domain.length > 128
      || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)
      || domain.split('.').some(label => label.startsWith('-') || label.endsWith('-'))) {
    throw new TypeError('Enter a valid email domain such as partner.com.');
  }
  return domain;
}

function normalizeDomains(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeDomain))].sort();
}

function normalizeState(value, fallbackDomains = []) {
  const state = value && typeof value === 'object' ? value : {};
  return {
    partnerDomains: normalizeDomains(state.partnerDomains ?? fallbackDomains),
    revision: Number.isInteger(state.revision) && state.revision > 0 ? state.revision : 1,
    updatedAt: state.updatedAt ? new Date(state.updatedAt).toISOString() : new Date().toISOString(),
    updatedBy: state.updatedBy ? String(state.updatedBy).slice(0, 80) : null,
  };
}

function domainConflict(message) {
  const error = new Error(message);
  error.code = 'DOMAIN_CONFLICT';
  return error;
}

class MemoryHostDomainRepository {
  constructor(seedDomains = []) {
    this.state = normalizeState(null, seedDomains);
  }

  async initialize() {}

  async getSettings() {
    return clone(this.state);
  }

  async addDomain(value, options = {}) {
    const domain = normalizeDomain(value);
    if (this.state.partnerDomains.includes(domain)) {
      throw domainConflict(`${domain} is already an allowed partner domain.`);
    }
    this.state = normalizeState({
      ...this.state,
      partnerDomains: [...this.state.partnerDomains, domain],
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: options.updatedBy,
    });
    return this.getSettings();
  }

  async removeDomain(value, options = {}) {
    const domain = normalizeDomain(value);
    if (!this.state.partnerDomains.includes(domain)) return null;
    this.state = normalizeState({
      ...this.state,
      partnerDomains: this.state.partnerDomains.filter(item => item !== domain),
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: options.updatedBy,
    });
    return this.getSettings();
  }
}

class FileHostDomainRepository extends MemoryHostDomainRepository {
  constructor(filePath, seedDomains = []) {
    super(seedDomains);
    this.filePath = filePath;
    this.seedDomains = seedDomains;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.state = normalizeState(JSON.parse(await fs.readFile(this.filePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = normalizeState(null, this.seedDomains);
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify(this.state);
    this.writeChain = this.writeChain.then(async () => {
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporaryPath, this.filePath);
    });
    return this.writeChain;
  }

  async addDomain(...args) {
    const result = await super.addDomain(...args);
    await this.persist();
    return result;
  }

  async removeDomain(...args) {
    const result = await super.removeDomain(...args);
    if (result) await this.persist();
    return result;
  }
}

class CosmosHostDomainRepository {
  constructor(options) {
    this.client = new CosmosClient({
      endpoint: options.endpoint,
      aadCredentials: new DefaultAzureCredential(),
    });
    this.databaseId = options.databaseId;
    this.contentContainerId = options.contentContainerId;
    this.seedDomains = options.seedDomains || [];
  }

  async initialize() {
    this.content = this.client.database(this.databaseId).container(this.contentContainerId);
    await this.content.read();
    const current = await this.readDocument();
    if (!current) {
      const state = normalizeState(null, this.seedDomains);
      try {
        await this.content.items.create(this.toDocument(state));
      } catch (error) {
        if (error.code !== 409) throw error;
      }
    }
  }

  async readDocument() {
    try {
      const { resource } = await this.content.item('settings:host-domains', 'host-domains').read();
      return resource || null;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getSettings() {
    const document = await this.readDocument();
    return normalizeState(document, this.seedDomains);
  }

  async update(mutator, updatedBy) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const document = await this.readDocument();
      const current = normalizeState(document, this.seedDomains);
      const partnerDomains = mutator([...current.partnerDomains]);
      if (partnerDomains === null) return null;
      const next = normalizeState({
        partnerDomains,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });
      try {
        const { resource } = await this.content.item('settings:host-domains', 'host-domains').replace(
          this.toDocument(next),
          document?._etag ? { accessCondition: { type: 'IfMatch', condition: document._etag } } : {},
        );
        return normalizeState(resource || next);
      } catch (error) {
        if (error.code !== 412) throw error;
      }
    }
    throw domainConflict('Host domains changed in another admin session. Reload and try again.');
  }

  async addDomain(value, options = {}) {
    const domain = normalizeDomain(value);
    return this.update(domains => {
      if (domains.includes(domain)) throw domainConflict(`${domain} is already an allowed partner domain.`);
      return [...domains, domain];
    }, options.updatedBy);
  }

  async removeDomain(value, options = {}) {
    const domain = normalizeDomain(value);
    return this.update(domains => domains.includes(domain)
      ? domains.filter(item => item !== domain)
      : null, options.updatedBy);
  }

  toDocument(state) {
    return {
      ...clone(state),
      id: 'settings:host-domains',
      batchId: 'host-domains',
      type: 'host-domain-settings',
    };
  }
}

function createHostDomainRepository(env = process.env, seedDomains = []) {
  if (env.COSMOS_ENDPOINT) {
    return new CosmosHostDomainRepository({
      endpoint: env.COSMOS_ENDPOINT,
      databaseId: env.COSMOS_DATABASE || 'livequiz',
      contentContainerId: env.COSMOS_CONTENT_CONTAINER || 'quizContent',
      seedDomains,
    });
  }
  if (env.NODE_ENV === 'test' && !env.HOST_DOMAIN_DATA_FILE) {
    return new MemoryHostDomainRepository(seedDomains);
  }
  return new FileHostDomainRepository(
    env.HOST_DOMAIN_DATA_FILE || path.join(__dirname, '..', 'data', 'host-domains.json'),
    seedDomains,
  );
}

module.exports = {
  CosmosHostDomainRepository,
  FileHostDomainRepository,
  MemoryHostDomainRepository,
  createHostDomainRepository,
  normalizeDomain,
  normalizeDomains,
};
