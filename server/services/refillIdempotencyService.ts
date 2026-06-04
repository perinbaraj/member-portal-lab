import { Redis } from "ioredis";
import type { RefillMutationResult } from "../types.js";

type CachedMutation = {
	expiresAt: number;
	result: RefillMutationResult;
};

export class RefillIdempotencyService {
	private cache = new Map<string, CachedMutation>();
	private redis = process.env.REDIS_URL
		? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
		: null;

	async get(key: string): Promise<RefillMutationResult | null> {
		if (this.redis) {
			try {
				if (this.redis.status === "wait") {
					await this.redis.connect();
				}
				const value = await this.redis.get(key);
				if (!value) {
					return null;
				}
				return JSON.parse(value) as RefillMutationResult;
			} catch {
				// Fall back to in-memory idempotency in local/lab mode.
			}
		}

		const record = this.cache.get(key);
		if (!record) {
			return null;
		}

		if (record.expiresAt <= Date.now()) {
			this.cache.delete(key);
			return null;
		}

		return record.result;
	}

	async set(
		key: string,
		result: RefillMutationResult,
		ttlMs: number
	): Promise<RefillMutationResult> {
		if (this.redis) {
			try {
				if (this.redis.status === "wait") {
					await this.redis.connect();
				}
				await this.redis.set(key, JSON.stringify(result), "PX", ttlMs);
				return result;
			} catch {
				// Fall back to in-memory idempotency in local/lab mode.
			}
		}

		this.cache.set(key, {
			expiresAt: Date.now() + ttlMs,
			result,
		});

		return result;
	}
}