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
  refillStatusReason:
    | "REFILL_AVAILABLE"
    | "NO_REFILLS_REMAINING"
    | "ALREADY_PENDING"
    | "ALREADY_PROCESSING"
    | "PRESCRIPTION_INACTIVE"
    | null;
  pendingRefillRequestedAt: string | null;
}

export interface RefillMutationResult {
  success: boolean;
  refillStatus: "pending" | "eligible";
  message: string;
  code: string | null;
  duplicate: boolean | null;
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
  status: PriorAuthStatus;
  procedureCode: string;
  referringProvider: string;
  clinicalJustification: string;
  preferredFacility: string;
  denialReasonCode: DenialReasonCode | null;
  denialReason: string | null;
  appealInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePriorAuthRequestInput {
  procedureCode: string;
  referringProvider: string;
  clinicalJustification: string;
  preferredFacility: string;
}

export interface PriorAuthListResult {
  requests: PriorAuthorizationRequest[];
  page: number;
  limit: number;
  total: number;
}
