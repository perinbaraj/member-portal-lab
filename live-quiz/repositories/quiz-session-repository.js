'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

class MemoryQuizSessionRepository {
  constructor(seed = []) {
    this.sessions = new Map(seed.map(session => [session.id, clone(session)]));
  }

  async initialize() {}

  async listSessions() {
    return [...this.sessions.values()].map(clone);
  }

  async getSession(id) {
    return clone(this.sessions.get(id) || null);
  }

  async saveSession(session) {
    this.sessions.set(session.id, clone(session));
    return clone(session);
  }

  async deleteSession(id) {
    this.sessions.delete(id);
  }
}

class FileQuizSessionRepository extends MemoryQuizSessionRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.sessions = new Map((stored.sessions || []).map(session => [session.id, session]));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify({ sessions: [...this.sessions.values()] });
    this.writeChain = this.writeChain.then(async () => {
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeChain;
  }

  async saveSession(session) {
    const result = await super.saveSession(session);
    await this.persist();
    return result;
  }

  async deleteSession(id) {
    await super.deleteSession(id);
    await this.persist();
  }
}

class CosmosQuizSessionRepository {
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

  async listSessions() {
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type',
      parameters: [{ name: '@type', value: 'quiz-session' }],
    };
    const { resources } = await this.content.items.query(query).fetchAll();
    return resources.map(resource => this.toSession(resource));
  }

  async getSession(id) {
    try {
      const { resource } = await this.content.item(`session:${id}`, id).read();
      return resource ? this.toSession(resource) : null;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async saveSession(session) {
    const document = {
      ...clone(session),
      id: `session:${session.id}`,
      sessionId: session.id,
      batchId: session.id,
      type: 'quiz-session',
    };
    await this.content.items.upsert(document);
    return clone(session);
  }

  async deleteSession(id) {
    try {
      await this.content.item(`session:${id}`, id).delete();
    } catch (error) {
      if (error.code !== 404) throw error;
    }
  }

  toSession(document) {
    const session = clone(document);
    session.id = document.sessionId;
    delete session.sessionId;
    delete session.batchId;
    delete session.type;
    delete session._rid;
    delete session._self;
    delete session._etag;
    delete session._attachments;
    delete session._ts;
    return session;
  }
}

function createQuizSessionRepository(env = process.env) {
  if (env.COSMOS_ENDPOINT) {
    return new CosmosQuizSessionRepository({
      endpoint: env.COSMOS_ENDPOINT,
      databaseId: env.COSMOS_DATABASE || 'livequiz',
      contentContainerId: env.COSMOS_CONTENT_CONTAINER || 'quizContent',
    });
  }
  if (env.NODE_ENV === 'test' && !env.SESSION_DATA_FILE) return new MemoryQuizSessionRepository();
  return new FileQuizSessionRepository(env.SESSION_DATA_FILE
    || path.join(__dirname, '..', 'data', 'quiz-sessions.json'));
}

module.exports = {
  CosmosQuizSessionRepository,
  FileQuizSessionRepository,
  MemoryQuizSessionRepository,
  createQuizSessionRepository,
};
