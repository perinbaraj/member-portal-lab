'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

class MemoryFeedbackRepository {
  constructor(seed = []) {
    this.feedback = seed.map(clone);
  }

  async initialize() {}

  async createFeedback(submission) {
    const stored = {
      ...clone(submission),
      status: submission.status || 'new',
      internalNote: submission.internalNote || '',
      reviewedBy: submission.reviewedBy || null,
      reviewedAt: submission.reviewedAt || null,
      resolvedAt: submission.resolvedAt || null,
      revision: Number.isInteger(submission.revision) ? submission.revision : 1,
    };
    this.feedback.push(stored);
    return clone(stored);
  }

  async listFeedback() {
    return this.feedback.map(clone);
  }

  async getFeedback(id) {
    return clone(this.feedback.find(item => item.id === id) || null);
  }

  async updateFeedback(id, updates, options = {}) {
    const index = this.feedback.findIndex(item => item.id === id);
    if (index < 0) return null;
    const current = this.feedback[index];
    if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
      const error = new Error('Feedback changed in another admin session. Reload it before saving again.');
      error.code = 'REVISION_CONFLICT';
      throw error;
    }
    const updated = {
      ...current,
      ...clone(updates),
      id,
      revision: (current.revision || 1) + 1,
    };
    this.feedback[index] = updated;
    return clone(updated);
  }
}

class FileFeedbackRepository extends MemoryFeedbackRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.feedback = Array.isArray(stored.feedback) ? stored.feedback : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify({ feedback: this.feedback });
    this.writeChain = this.writeChain.then(async () => {
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeChain;
  }

  async createFeedback(submission) {
    const result = await super.createFeedback(submission);
    await this.persist();
    return result;
  }

  async updateFeedback(id, updates, options) {
    const result = await super.updateFeedback(id, updates, options);
    if (result) await this.persist();
    return result;
  }
}

class CosmosFeedbackRepository {
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

  async createFeedback(submission) {
    const normalized = {
      ...clone(submission),
      status: submission.status || 'new',
      internalNote: submission.internalNote || '',
      reviewedBy: submission.reviewedBy || null,
      reviewedAt: submission.reviewedAt || null,
      resolvedAt: submission.resolvedAt || null,
      revision: Number.isInteger(submission.revision) ? submission.revision : 1,
    };
    const document = {
      ...normalized,
      id: `feedback:${submission.id}`,
      feedbackId: submission.id,
      batchId: submission.id,
      type: 'feedback',
    };
    await this.content.items.create(document);
    return clone(normalized);
  }

  async listFeedback() {
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.createdAt DESC',
      parameters: [{ name: '@type', value: 'feedback' }],
    };
    const { resources } = await this.content.items.query(query).fetchAll();
    return resources.map(resource => this.toFeedback(resource));
  }

  async getFeedback(id) {
    try {
      const { resource } = await this.content.item(`feedback:${id}`, id).read();
      return resource ? this.toFeedback(resource) : null;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateFeedback(id, updates, options = {}) {
    const current = await this.getFeedback(id);
    if (!current) return null;
    if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
      const error = new Error('Feedback changed in another admin session. Reload it before saving again.');
      error.code = 'REVISION_CONFLICT';
      throw error;
    }
    const updated = {
      ...current,
      ...clone(updates),
      id,
      revision: (current.revision || 1) + 1,
    };
    const document = {
      ...updated,
      id: `feedback:${id}`,
      feedbackId: id,
      batchId: id,
      type: 'feedback',
    };
    delete document._etag;
    const optionsForReplace = current._etag ? { accessCondition: { type: 'IfMatch', condition: current._etag } } : {};
    try {
      const { resource } = await this.content.item(`feedback:${id}`, id).replace(document, optionsForReplace);
      return this.toFeedback(resource || document);
    } catch (error) {
      if (error.code === 412) {
        const conflict = new Error('Feedback changed in another admin session. Reload it before saving again.');
        conflict.code = 'REVISION_CONFLICT';
        throw conflict;
      }
      throw error;
    }
  }

  toFeedback(document) {
    const result = clone(document);
    result.id = document.feedbackId;
    delete result.feedbackId;
    delete result.batchId;
    delete result.type;
    delete result._rid;
    delete result._self;
    delete result._attachments;
    delete result._ts;
    return result;
  }
}

function createFeedbackRepository(env = process.env) {
  if (env.COSMOS_ENDPOINT) {
    return new CosmosFeedbackRepository({
      endpoint: env.COSMOS_ENDPOINT,
      databaseId: env.COSMOS_DATABASE || 'livequiz',
      contentContainerId: env.COSMOS_CONTENT_CONTAINER || 'quizContent',
    });
  }
  if (env.NODE_ENV === 'test' && !env.FEEDBACK_DATA_FILE) return new MemoryFeedbackRepository();
  return new FileFeedbackRepository(env.FEEDBACK_DATA_FILE
    || path.join(__dirname, '..', 'data', 'feedback.json'));
}

module.exports = {
  CosmosFeedbackRepository,
  FileFeedbackRepository,
  MemoryFeedbackRepository,
  createFeedbackRepository,
};
