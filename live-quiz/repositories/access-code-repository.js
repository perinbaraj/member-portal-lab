'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizeHostIdentity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) throw new TypeError('A host identity is required.');
  return normalized;
}

function normalizeDate(value, fieldName) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${fieldName} must be a valid date.`);
  return date.toISOString();
}

function normalizeRecord(hostIdentity, record) {
  if (!record || typeof record !== 'object') throw new TypeError('Access-code metadata is required.');
  if (!record.digest || !record.salt) throw new TypeError('Access-code digest and salt are required.');
  return {
    hostIdentity: normalizeHostIdentity(hostIdentity || record.hostIdentity),
    id: String(record.id || ''),
    email: record.email ? String(record.email).trim().toLowerCase() : null,
    digest: String(record.digest),
    salt: String(record.salt),
    createdAt: normalizeDate(record.createdAt || Date.now(), 'createdAt'),
    expiresAt: normalizeDate(record.expiresAt, 'expiresAt'),
    attempts: Math.max(0, Number.isInteger(record.attempts) ? record.attempts : 0),
    maxAttempts: Math.max(1, Number.isInteger(record.maxAttempts) ? record.maxAttempts : 5),
    redeemedAt: record.redeemedAt ? normalizeDate(record.redeemedAt, 'redeemedAt') : null,
    createdBy: record.createdBy ? String(record.createdBy).slice(0, 80) : null,
    revision: Number.isInteger(record.revision) && record.revision > 0 ? record.revision : 1,
  };
}

function revisionConflict() {
  const error = new Error('The access code changed in another admin session. Reload it before saving again.');
  error.code = 'REVISION_CONFLICT';
  return error;
}

function saveArguments(hostIdentityOrRecord, maybeRecord) {
  if (maybeRecord === undefined && hostIdentityOrRecord && typeof hostIdentityOrRecord === 'object') {
    return [hostIdentityOrRecord.hostIdentity, hostIdentityOrRecord];
  }
  return [hostIdentityOrRecord, maybeRecord];
}

function consumeArguments(digestOrOptions, redeemedAt) {
  if (digestOrOptions && typeof digestOrOptions === 'object') {
    return {
      digest: digestOrOptions.digest,
      now: digestOrOptions.now || digestOrOptions.redeemedAt || redeemedAt || Date.now(),
    };
  }
  return { digest: digestOrOptions, now: redeemedAt || Date.now() };
}

class MemoryAccessCodeRepository {
  constructor(seed = []) {
    this.codes = new Map();
    for (const record of seed) {
      const normalized = normalizeRecord(record.hostIdentity, record);
      this.codes.set(normalized.hostIdentity, normalized);
    }
  }

  async initialize() {}

  async save(hostIdentityOrRecord, maybeRecord) {
    const [hostIdentity, record] = saveArguments(hostIdentityOrRecord, maybeRecord);
    const stored = normalizeRecord(hostIdentity, record);
    const current = this.codes.get(stored.hostIdentity);
    stored.revision = current ? current.revision + 1 : 1;
    this.codes.set(stored.hostIdentity, clone(stored));
    return clone(stored);
  }

  async get(hostIdentity) {
    return clone(this.codes.get(normalizeHostIdentity(hostIdentity)) || null);
  }

  async delete(hostIdentity) {
    return this.codes.delete(normalizeHostIdentity(hostIdentity));
  }

  async listCodes(options = {}) {
    const now = new Date(options.now || Date.now()).getTime();
    const includeInactive = options.includeInactive === true;
    return [...this.codes.values()]
      .filter(record => includeInactive
        || (!record.redeemedAt && new Date(record.expiresAt).getTime() > now))
      .sort((left, right) => left.hostIdentity.localeCompare(right.hostIdentity))
      .map(clone);
  }

  async updateCode(hostIdentity, updates, options = {}) {
    const identity = normalizeHostIdentity(hostIdentity);
    const current = this.codes.get(identity);
    if (!current) return null;
    if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
      throw revisionConflict();
    }
    const updated = normalizeRecord(identity, {
      ...current,
      ...clone(updates),
      hostIdentity: identity,
      revision: current.revision + 1,
    });
    this.codes.set(identity, updated);
    return clone(updated);
  }

  async consume(hostIdentity, digestOrOptions, redeemedAt) {
    const identity = normalizeHostIdentity(hostIdentity);
    const current = this.codes.get(identity);
    if (!current || current.redeemedAt) return null;
    const options = consumeArguments(digestOrOptions, redeemedAt);
    const now = normalizeDate(options.now, 'redeemedAt');
    const updated = { ...current, attempts: current.attempts + 1, revision: current.revision + 1 };
    if (new Date(current.expiresAt).getTime() <= new Date(now).getTime()
        || !options.digest || current.digest !== String(options.digest)) {
      this.codes.set(identity, updated);
      return null;
    }
    updated.redeemedAt = now;
    this.codes.set(identity, updated);
    return clone(updated);
  }

  async saveAccessCode(...args) { return this.save(...args); }
  async getAccessCode(...args) { return this.get(...args); }
  async deleteAccessCode(...args) { return this.delete(...args); }
  async consumeAccessCode(...args) { return this.consume(...args); }
  async listAccessCodes(...args) { return this.listCodes(...args); }
  async updateAccessCode(...args) { return this.updateCode(...args); }
}

class FileAccessCodeRepository extends MemoryAccessCodeRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.codes = new Map((stored.codes || []).map(record => {
        const normalized = normalizeRecord(record.hostIdentity, record);
        return [normalized.hostIdentity, normalized];
      }));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify({ codes: [...this.codes.values()].map(clone) });
    this.writeChain = this.writeChain.then(async () => {
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeChain;
  }

  async save(...args) {
    const stored = await super.save(...args);
    await this.persist();
    return stored;
  }

  async delete(...args) {
    const deleted = await super.delete(...args);
    if (deleted) await this.persist();
    return deleted;
  }

  async updateCode(...args) {
    const updated = await super.updateCode(...args);
    if (updated) await this.persist();
    return updated;
  }

  async consume(...args) {
    const identity = normalizeHostIdentity(args[0]);
    const before = await super.get(identity);
    const result = await super.consume(...args);
    const after = await super.get(identity);
    if (before && after && (before.attempts !== after.attempts || before.redeemedAt !== after.redeemedAt)) {
      await this.persist();
    }
    return result;
  }
}

class CosmosAccessCodeRepository {
  constructor(options) {
    this.client = new CosmosClient({
      endpoint: options.endpoint,
      aadCredentials: new DefaultAzureCredential(),
    });
    this.databaseId = options.databaseId;
    this.contentContainerId = options.contentContainerId;
  }

  async initialize() {
    this.content = this.client.database(this.databaseId).container(this.contentContainerId);
    await this.content.read();
  }

  documentId(hostIdentity) {
    return `access-code:${hostIdentity}`;
  }

  async save(hostIdentityOrRecord, maybeRecord) {
    const [hostIdentity, record] = saveArguments(hostIdentityOrRecord, maybeRecord);
    const identity = normalizeHostIdentity(hostIdentity || record.hostIdentity);
    const current = await this.get(identity);
    const stored = normalizeRecord(identity, {
      ...record,
      revision: current ? current.revision + 1 : 1,
    });
    await this.content.items.upsert(this.toDocument(stored));
    return clone(stored);
  }

  async get(hostIdentity) {
    const identity = normalizeHostIdentity(hostIdentity);
    try {
      const { resource } = await this.content.item(this.documentId(identity), identity).read();
      return resource ? this.toRecord(resource) : null;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async delete(hostIdentity) {
    const identity = normalizeHostIdentity(hostIdentity);
    try {
      await this.content.item(this.documentId(identity), identity).delete();
      return true;
    } catch (error) {
      if (error.code === 404) return false;
      throw error;
    }
  }

  async listCodes(options = {}) {
    const parameters = [{ name: '@type', value: 'access-code' }];
    let query = 'SELECT * FROM c WHERE c.type = @type';
    if (options.includeInactive !== true) {
      query += ' AND IS_NULL(c.redeemedAt) AND c.expiresAt > @now';
      parameters.push({ name: '@now', value: normalizeDate(options.now || Date.now(), 'now') });
    }
    query += ' ORDER BY c.hostIdentity';
    const { resources } = await this.content.items.query({ query, parameters }).fetchAll();
    return resources.map(resource => this.toRecord(resource));
  }

  async updateCode(hostIdentity, updates, options = {}) {
    const identity = normalizeHostIdentity(hostIdentity);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let resource;
      try {
        ({ resource } = await this.content.item(this.documentId(identity), identity).read());
      } catch (error) {
        if (error.code === 404) return null;
        throw error;
      }
      const current = this.toRecord(resource);
      if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
        throw revisionConflict();
      }
      const updated = normalizeRecord(identity, {
        ...current,
        ...clone(updates),
        hostIdentity: identity,
        revision: current.revision + 1,
      });
      try {
        const { resource: replaced } = await this.content.item(resource.id, identity).replace(
          this.toDocument(updated),
          { accessCondition: { type: 'IfMatch', condition: resource._etag } },
        );
        return this.toRecord(replaced || this.toDocument(updated));
      } catch (error) {
        if (error.code !== 412) throw error;
        if (options.expectedRevision !== undefined) throw revisionConflict();
      }
    }
    throw revisionConflict();
  }

  async consume(hostIdentity, digestOrOptions, redeemedAt) {
    const identity = normalizeHostIdentity(hostIdentity);
    const options = consumeArguments(digestOrOptions, redeemedAt);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let resource;
      try {
        ({ resource } = await this.content.item(this.documentId(identity), identity).read());
      } catch (error) {
        if (error.code === 404) return null;
        throw error;
      }
      if (!resource || resource.redeemedAt) return null;
      const current = this.toRecord(resource);
      const now = normalizeDate(options.now, 'redeemedAt');
      const updated = {
        ...current,
        attempts: current.attempts + 1,
        revision: current.revision + 1,
      };
      const valid = new Date(current.expiresAt).getTime() > new Date(now).getTime()
        && options.digest && current.digest === String(options.digest);
      if (valid) updated.redeemedAt = now;
      try {
        await this.content.item(resource.id, identity).replace(
          this.toDocument(updated),
          { accessCondition: { type: 'IfMatch', condition: resource._etag } },
        );
        return valid ? clone(updated) : null;
      } catch (error) {
        if (error.code !== 412) throw error;
      }
    }
    const error = new Error('The access code changed while it was being consumed.');
    error.code = 'ACCESS_CODE_CONFLICT';
    throw error;
  }

  toDocument(record) {
    return {
      ...clone(record),
      id: this.documentId(record.hostIdentity),
      batchId: record.hostIdentity,
      type: 'access-code',
    };
  }

  toRecord(document) {
    return normalizeRecord(document.hostIdentity || document.batchId, document);
  }

  async saveAccessCode(...args) { return this.save(...args); }
  async getAccessCode(...args) { return this.get(...args); }
  async deleteAccessCode(...args) { return this.delete(...args); }
  async consumeAccessCode(...args) { return this.consume(...args); }
  async listAccessCodes(...args) { return this.listCodes(...args); }
  async updateAccessCode(...args) { return this.updateCode(...args); }
}

function createAccessCodeRepository(env = process.env) {
  if (env.COSMOS_ENDPOINT) {
    return new CosmosAccessCodeRepository({
      endpoint: env.COSMOS_ENDPOINT,
      databaseId: env.COSMOS_DATABASE || 'livequiz',
      contentContainerId: env.COSMOS_CONTENT_CONTAINER || 'quizContent',
    });
  }
  if (env.NODE_ENV === 'test' && !env.ACCESS_CODE_DATA_FILE) return new MemoryAccessCodeRepository();
  return new FileAccessCodeRepository(env.ACCESS_CODE_DATA_FILE
    || path.join(__dirname, '..', 'data', 'access-codes.json'));
}

module.exports = {
  CosmosAccessCodeRepository,
  FileAccessCodeRepository,
  MemoryAccessCodeRepository,
  createAccessCodeRepository,
  normalizeHostIdentity,
};
