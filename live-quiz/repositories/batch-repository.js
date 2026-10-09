'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function conflictError() {
  const error = new Error('This draft changed in another host session. Reload it before saving again.');
  error.code = 'REVISION_CONFLICT';
  return error;
}

class MemoryBatchRepository {
  constructor(seed = {}) {
    this.batches = new Map(Object.entries(seed.batches || {}));
    this.revisions = [];
  }

  async initialize() {}

  async listActiveBatches() {
    return [...this.batches.values()].filter(doc => doc.state === 'active').map(clone);
  }

  async listBatchIds() {
    return [...this.batches.keys()];
  }

  async getBatch(id) {
    return clone(this.batches.get(id) || null);
  }

  async createBatch(batch, options = {}) {
    if (this.batches.has(batch.id)) {
      const error = new Error(`Batch id "${batch.id}" already exists.`);
      error.code = 'BATCH_EXISTS';
      throw error;
    }
    const timestamp = now();
    const document = {
      ...clone(batch),
      state: options.state || 'active',
      source: options.source || 'manual',
      ownerUserId: options.ownerUserId || batch.ownerUserId || null,
      updatedBy: options.updatedBy || options.ownerUserId || batch.updatedBy || batch.ownerUserId || null,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      publishedAt: options.publishedAt || timestamp,
    };
    this.batches.set(document.id, document);
    this.revisions.push({ ...clone(document), revisionId: randomUUID() });
    return clone(document);
  }

  async updateBatch(id, batch, options = {}) {
    const current = this.batches.get(id);
    if (!current) throw new Error('The batch no longer exists.');
    if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
      throw conflictError();
    }
    if (options.ownerUserId && current.ownerUserId && current.ownerUserId !== options.ownerUserId) {
      const error = new Error('This batch is owned by another host. Reload the latest version or save a new copy.');
      error.code = 'BATCH_OWNER_MISMATCH';
      throw error;
    }
    const document = {
      ...clone(batch),
      id,
      state: options.state || current.state,
      source: current.source,
      ownerUserId: options.ownerUserId || current.ownerUserId || null,
      updatedBy: options.updatedBy || options.ownerUserId || current.updatedBy || current.ownerUserId || null,
      revision: current.revision + 1,
      createdAt: current.createdAt,
      updatedAt: now(),
      publishedAt: options.publishedAt || current.publishedAt || current.updatedAt || now(),
    };
    this.batches.set(id, document);
    this.revisions.push({ ...clone(document), revisionId: randomUUID() });
    return clone(document);
  }

}

class FileBatchRepository extends MemoryBatchRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.batches = new Map(Object.entries(stored.batches || {}));
      this.revisions = Array.isArray(stored.revisions) ? stored.revisions : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify({
      batches: Object.fromEntries(this.batches),
      revisions: this.revisions,
    });
    this.writeChain = this.writeChain.then(async () => {
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeChain;
  }

  async createBatch(batch, options) {
    const result = await super.createBatch(batch, options);
    await this.persist();
    return result;
  }

  async updateBatch(id, batch, options) {
    const result = await super.updateBatch(id, batch, options);
    await this.persist();
    return result;
  }

}

class CosmosBatchRepository {
  constructor(options) {
    const credential = new DefaultAzureCredential();
    this.client = new CosmosClient({ endpoint: options.endpoint, aadCredentials: credential });
    this.databaseId = options.databaseId;
    this.contentContainerId = options.contentContainerId;
  }

  async initialize() {
    const database = this.client.database(this.databaseId);
    this.content = database.container(this.contentContainerId);
    await this.content.read();
  }

  async listActiveBatches() {
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.state = @state',
      parameters: [{ name: '@type', value: 'batch' }, { name: '@state', value: 'active' }],
    };
    const { resources } = await this.content.items.query(query).fetchAll();
    return resources.map(resource => this.toBatchDocument(resource));
  }

  async listBatchIds() {
    const query = {
      query: 'SELECT c.batchId FROM c WHERE c.type = @type',
      parameters: [{ name: '@type', value: 'batch' }],
    };
    const { resources } = await this.content.items.query(query).fetchAll();
    return resources.map(resource => resource.batchId);
  }

  async getBatch(id) {
    try {
      const { resource } = await this.content.item(`batch:${id}`, id).read();
      return resource ? this.toBatchDocument(resource) : null;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async createBatch(batch, options = {}) {
    const timestamp = now();
    const document = {
      ...clone(batch),
      id: `batch:${batch.id}`,
      batchId: batch.id,
      type: 'batch',
      state: options.state || 'active',
      source: options.source || 'manual',
      ownerUserId: options.ownerUserId || batch.ownerUserId || null,
      updatedBy: options.updatedBy || options.ownerUserId || batch.updatedBy || batch.ownerUserId || null,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      publishedAt: options.publishedAt || timestamp,
    };
    const revision = {
      ...clone(document),
      id: `revision:${batch.id}:1`,
      type: 'revision',
    };
    const response = await this.content.items.batch([
      { operationType: 'Create', resourceBody: document },
      { operationType: 'Create', resourceBody: revision },
    ], batch.id);
    if (!response.result.every(item => item.statusCode >= 200 && item.statusCode < 300)) {
      throw new Error('Cosmos DB did not persist the batch revision.');
    }
    return this.toBatchDocument(document);
  }

  async updateBatch(id, batch, options = {}) {
    const current = await this.getBatch(id);
    if (!current) throw new Error('The batch no longer exists.');
    if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
      throw conflictError();
    }
    if (options.ownerUserId && current.ownerUserId && current.ownerUserId !== options.ownerUserId) {
      const error = new Error('This batch is owned by another host. Reload the latest version or save a new copy.');
      error.code = 'BATCH_OWNER_MISMATCH';
      throw error;
    }
    const revisionNumber = current.revision + 1;
    const document = {
      ...clone(batch),
      id: `batch:${id}`,
      batchId: id,
      type: 'batch',
      state: options.state || current.state,
      source: current.source,
      ownerUserId: options.ownerUserId || current.ownerUserId || null,
      updatedBy: options.updatedBy || options.ownerUserId || current.updatedBy || current.ownerUserId || null,
      revision: revisionNumber,
      createdAt: current.createdAt,
      updatedAt: now(),
      publishedAt: options.publishedAt || current.publishedAt || current.updatedAt || now(),
    };
    const revision = { ...clone(document), id: `revision:${id}:${revisionNumber}`, type: 'revision' };
    const response = await this.content.items.batch([
      {
        operationType: 'Replace',
        id: `batch:${id}`,
        resourceBody: document,
        ifMatch: current._etag,
      },
      { operationType: 'Create', resourceBody: revision },
    ], id);
    if (!response.result.every(item => item.statusCode >= 200 && item.statusCode < 300)) {
      throw new Error('Cosmos DB did not persist the batch revision.');
    }
    return this.toBatchDocument(document);
  }

  toBatchDocument(document) {
    const result = clone(document);
    result.id = document.batchId;
    delete result.batchId;
    delete result.type;
    return result;
  }

}

function createBatchRepository(env = process.env) {
  if (env.COSMOS_ENDPOINT) {
    return new CosmosBatchRepository({
      endpoint: env.COSMOS_ENDPOINT,
      databaseId: env.COSMOS_DATABASE || 'livequiz',
      contentContainerId: env.COSMOS_CONTENT_CONTAINER || 'quizContent',
    });
  }
  if (env.NODE_ENV === 'test' && !env.BATCH_DATA_FILE) return new MemoryBatchRepository();
  return new FileBatchRepository(env.BATCH_DATA_FILE
    || path.join(__dirname, '..', 'data', 'quiz-content.json'));
}

module.exports = {
  CosmosBatchRepository,
  FileBatchRepository,
  MemoryBatchRepository,
  createBatchRepository,
};
