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

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
