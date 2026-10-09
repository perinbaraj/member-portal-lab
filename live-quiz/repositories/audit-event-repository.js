'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const RETENTION_DAYS = 90;
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
const RETENTION_MILLISECONDS = RETENTION_SECONDS * 1000;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function timestamp(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date is required.');
  return date;
}

function normalizeEvent(event) {
  const createdAt = timestamp(event.createdAt || Date.now());
  const expiresAt = new Date(createdAt.getTime() + RETENTION_MILLISECONDS);
  return {
    ...clone(event),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttl: RETENTION_SECONDS,
  };
}

function eventMatches(event, options) {
  const filters = { ...(options.filters || {}), ...options };
  const eventTypes = filters.eventTypes || filters.types;
  const from = filters.from || filters.createdAfter;
  const to = filters.to || filters.createdBefore;
  if (filters.eventType && event.eventType !== filters.eventType) return false;
  if (filters.type && event.eventType !== filters.type && event.type !== filters.type) return false;
  if (Array.isArray(eventTypes) && !eventTypes.includes(event.eventType || event.type)) return false;
  if (filters.actorId && event.actorId !== filters.actorId) return false;
  if (filters.hostIdentity && event.hostIdentity !== filters.hostIdentity) return false;
  if (filters.sessionId && event.sessionId !== filters.sessionId) return false;
  if (filters.outcome && event.outcome !== filters.outcome) return false;
  if (from && timestamp(event.createdAt).getTime() < timestamp(from).getTime()) return false;
  if (to && timestamp(event.createdAt).getTime() > timestamp(to).getTime()) return false;
  return true;
}

function compareEvents(left, right) {
  const byDate = String(right.createdAt).localeCompare(String(left.createdAt));
  return byDate || String(right.id).localeCompare(String(left.id));
}

function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  if (Number.isInteger(cursor) && cursor >= 0) return cursor;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    return Number.isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

function pageResult(events, nextCursor, total) {
  const items = events.map(clone);
  return {
    events: items.map(clone),
    items,
    nextCursor,
    continuationToken: nextCursor,
    hasMore: Boolean(nextCursor),
    total,
  };
}

class MemoryAuditEventRepository {
  constructor(seed = []) {
    this.events = seed.map(event => normalizeEvent(event));
  }

  async initialize() {
    await this.cleanupExpiredEvents();
  }

  async createEvent(event) {
    const stored = normalizeEvent(event);
    this.events.push(stored);
    return clone(stored);
  }

  async listEvents(options = {}) {
    const limit = Math.max(1, Math.min(200, Number(options.limit || options.pageSize) || 50));
    const offset = decodeCursor(options.cursor || options.continuationToken);
    const matching = this.events.filter(event => eventMatches(event, options)).sort(compareEvents);
    const events = matching.slice(offset, offset + limit);
    const nextOffset = offset + events.length;
    return pageResult(events, nextOffset < matching.length ? encodeCursor(nextOffset) : null, matching.length);
  }

  async cleanupExpiredEvents(now = Date.now()) {
    const cutoff = timestamp(now).getTime();
    const retained = this.events.filter(event => timestamp(event.expiresAt).getTime() > cutoff);
    const deleted = this.events.length - retained.length;
    this.events = retained;
    return deleted;
  }

  async cleanupExpired(now) {
    return this.cleanupExpiredEvents(now);
  }
}

class FileAuditEventRepository extends MemoryAuditEventRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.events = Array.isArray(stored.events) ? stored.events.map(normalizeEvent) : [];
      const deleted = await super.cleanupExpiredEvents();
      if (deleted) await this.persist();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify({ events: this.events.map(clone) });
    this.writeChain = this.writeChain.then(async () => {
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeChain;
  }

  async createEvent(event) {
    const stored = await super.createEvent(event);
    await this.persist();
    return stored;
  }

  async cleanupExpiredEvents(now) {
    const deleted = await super.cleanupExpiredEvents(now);
    if (deleted) await this.persist();
    return deleted;
  }
}

class CosmosAuditEventRepository {
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

  async createEvent(event) {
    const normalized = normalizeEvent(event);
    const document = {
      ...clone(normalized),
      id: `audit-event:${normalized.id}`,
      eventId: normalized.id,
      batchId: normalized.id,
      type: 'audit-event',
    };
    await this.content.items.create(document);
    return clone(normalized);
  }

  async listEvents(options = {}) {
    const filters = { ...(options.filters || {}), ...options };
    const parameters = [{ name: '@type', value: 'audit-event' }];
    const conditions = ['c.type = @type'];
    const addFilter = (field, value) => {
      if (value === undefined || value === null || value === '') return;
      const name = `@${field}`;
      conditions.push(`c.${field} = ${name}`);
      parameters.push({ name, value });
    };
    addFilter('eventType', filters.eventType);
    addFilter('actorId', filters.actorId);
    addFilter('hostIdentity', filters.hostIdentity);
    addFilter('sessionId', filters.sessionId);
    addFilter('outcome', filters.outcome);
    if (filters.from || filters.createdAfter) {
      conditions.push('c.createdAt >= @from');
      parameters.push({ name: '@from', value: timestamp(filters.from || filters.createdAfter).toISOString() });
    }
    if (filters.to || filters.createdBefore) {
      conditions.push('c.createdAt <= @to');
      parameters.push({ name: '@to', value: timestamp(filters.to || filters.createdBefore).toISOString() });
    }
    const query = {
      query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.createdAt DESC`,
      parameters,
    };
    const limit = Math.max(1, Math.min(200, Number(options.limit || options.pageSize) || 50));
    const iterator = this.content.items.query(query, {
      continuationToken: options.cursor || options.continuationToken || undefined,
      maxItemCount: limit,
    });
    const response = await iterator.fetchNext();
    const events = (response.resources || []).map(resource => this.toEvent(resource));
    return pageResult(events, response.continuationToken || null, undefined);
  }

  async cleanupExpiredEvents(now = Date.now()) {
    const query = {
      query: 'SELECT c.id, c.batchId FROM c WHERE c.type = @type AND c.expiresAt <= @now',
      parameters: [
        { name: '@type', value: 'audit-event' },
        { name: '@now', value: timestamp(now).toISOString() },
      ],
    };
    const { resources } = await this.content.items.query(query).fetchAll();
    await Promise.all(resources.map(document => this.content.item(document.id, document.batchId).delete()));
    return resources.length;
  }

  async cleanupExpired(now) {
    return this.cleanupExpiredEvents(now);
  }

  toEvent(document) {
    const event = clone(document);
    event.id = document.eventId;
    delete event.eventId;
    delete event.batchId;
    delete event.type;
    delete event._rid;
    delete event._self;
    delete event._etag;
    delete event._attachments;
    delete event._ts;
    return event;
  }
}

function createAuditEventRepository(env = process.env) {
  if (env.COSMOS_ENDPOINT) {
    return new CosmosAuditEventRepository({
      endpoint: env.COSMOS_ENDPOINT,
      databaseId: env.COSMOS_DATABASE || 'livequiz',
      contentContainerId: env.COSMOS_CONTENT_CONTAINER || 'quizContent',
    });
  }
  if (env.NODE_ENV === 'test' && !env.AUDIT_EVENT_DATA_FILE) return new MemoryAuditEventRepository();
  return new FileAuditEventRepository(env.AUDIT_EVENT_DATA_FILE
    || path.join(__dirname, '..', 'data', 'audit-events.json'));
}

module.exports = {
  CosmosAuditEventRepository,
  FileAuditEventRepository,
  MemoryAuditEventRepository,
  RETENTION_DAYS,
  RETENTION_SECONDS,
  createAuditEventRepository,
};
