export interface Member {
  memberId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  planId: string;
  planName: string;
}

export interface Prescription {
  prescriptionId: string;
  memberId: string;
  medicationName: string;
  dosage: string;
  lastFilledDate: string;
  refillsRemaining: number;
  prescriptionStatus: "active" | "expired" | "discontinued";
  refillStatus: "eligible" | "pending" | "processing" | "ineligible";
  refillStatusReason: RefillStatusReason | null;
  pendingRefillRequestedAt: string | null;
}

export type RefillStatusReason =
  | "REFILL_AVAILABLE"
  | "NO_REFILLS_REMAINING"
  | "ALREADY_PENDING"
  | "ALREADY_PROCESSING"
  | "PRESCRIPTION_INACTIVE";

export interface RefillRequest {
  refillRequestId: string;
  prescriptionId: string;
  memberId: string;
  status: "pending" | "processing" | "canceled";
  requestedAt: string;
  updatedAt: string;
  canceledAt: string | null;
  downstreamReference: string | null;
}

export interface RefillMutationResult {
  success: boolean;
  refillStatus: "pending" | "eligible";
  message: string;
  code: RefillMutationCode | null;
  duplicate: boolean | null;
}

export type RefillMutationCode =
  | "REFILL_PENDING"
  | "REFILL_ALREADY_PENDING"
  | "REFILL_CANCELED"
  | "REFILL_INELIGIBLE"
  | "REFILL_ALREADY_PROCESSING"
  | "REFILL_NOT_PENDING";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    public code: string | null = null
  ) {
    super(message);
  }
}

export interface Claim {
  claimId: string;
  memberId: string;
  providerId: string;
  providerName: string;
  serviceDate: string;
  amount: number;
  status: "submitted" | "in_review" | "approved" | "denied" | "appealed";
  diagnosisCode: string;
  procedureCode: string;
}

export interface AuthContext {
  memberId: string;
  email: string;
  roles: string[];
}

export type PriorAuthStatus = "pending" | "approved" | "denied" | "expired";

export type DenialReasonCode =
  | "medical_necessity"
  | "missing_documentation"
  | "non_covered_service"
  | "eligibility_issue"
  | "duplicate_request"
  | "other";

export interface PriorAuthorizationRequest {
  requestId: string;
  memberId: string;
  procedureCode: string;
  referringProvider: string;
  clinicalJustification: string;
  preferredFacility: string;
  status: PriorAuthStatus;
  denialReasonCode: DenialReasonCode | null;
  denialReason: string | null;
  appealInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PriorAuthActorType = "member" | "system" | "reviewer";

export interface StatusTransitionAuditEvent {
  eventId: string;
  requestId: string;
  memberId: string;
  actorType: PriorAuthActorType;
  fromStatus: PriorAuthStatus | null;
  toStatus: PriorAuthStatus;
  occurredAt: string;
  reasonCode: string | null;
}

export interface CreatePriorAuthRequestInput {
  procedureCode: string;
  referringProvider: string;
  clinicalJustification: string;
  preferredFacility: string;
}

export interface PriorAuthListResponse {
  requests: PriorAuthorizationRequest[];
  page: number;
  limit: number;
  total: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
