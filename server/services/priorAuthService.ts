import {
  createPriorAuthRequest,
  getPriorAuthAuditEventsForRequest,
  getPriorAuthRequest,
  getPriorAuthRequestById,
  listPriorAuthRequests,
} from "../data.js";
import {
  AppError,
  CreatePriorAuthRequestInput,
  PriorAuthListResponse,
  PriorAuthorizationRequest,
  StatusTransitionAuditEvent,
} from "../types.js";

type CachedCreateResult = {
  expiresAt: number;
  request: PriorAuthorizationRequest;
};

const CREATE_IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function buildCreateIdempotencyKey(memberId: string, input: CreatePriorAuthRequestInput): string {
  return [
    memberId,
    input.procedureCode.trim().toLowerCase(),
    input.referringProvider.trim().toLowerCase(),
    input.clinicalJustification.trim().toLowerCase(),
    input.preferredFacility.trim().toLowerCase(),
  ].join("|");
}

export class PriorAuthService {
  private createCache = new Map<string, CachedCreateResult>();

  list(memberId: string, page = 1, limit = 20): PriorAuthListResponse {
    return listPriorAuthRequests(memberId, page, limit);
  }

  getById(memberId: string, requestId: string): PriorAuthorizationRequest {
    const byId = getPriorAuthRequestById(requestId);
    if (!byId) {
      throw new AppError(404, "NotFound", "Prior authorization request not found.");
    }

    if (byId.memberId !== memberId) {
      throw new AppError(403, "Forbidden", "You cannot access this request.", "FORBIDDEN");
    }

    const request = getPriorAuthRequest(requestId, memberId);
    if (!request) {
      throw new AppError(404, "NotFound", "Prior authorization request not found.");
    }

    return request;
  }

  create(memberId: string, input: CreatePriorAuthRequestInput): PriorAuthorizationRequest {
    const key = buildCreateIdempotencyKey(memberId, input);
    const cached = this.createCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.request;
    }

    if (cached && cached.expiresAt <= Date.now()) {
      this.createCache.delete(key);
    }

    const created = createPriorAuthRequest(memberId, input);
    this.createCache.set(key, {
      expiresAt: Date.now() + CREATE_IDEMPOTENCY_TTL_MS,
      request: created,
    });

    return created;
  }

  getAuditEvents(memberId: string, requestId: string): StatusTransitionAuditEvent[] {
    const request = this.getById(memberId, requestId);
    return getPriorAuthAuditEventsForRequest(request.requestId, request.memberId);
  }
}
