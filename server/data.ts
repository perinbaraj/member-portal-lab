import {
  Member,
  Prescription,
  Claim,
  RefillRequest,
  RefillMutationResult,
  AppError,
} from "./types.js";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MEMBERS: Member[] = [
  {
    memberId: "M-10001",
    firstName: "Sarah",
    lastName: "Johnson",
    dateOfBirth: "Not Provided",
    planId: "PLAN-GOLD-A",
    planName: "Gold PPO",
  },
  {
    memberId: "M-10002",
    firstName: "James",
    lastName: "Williams",
    dateOfBirth: "Not Provided",
    planId: "PLAN-SILVER-B",
    planName: "Silver HMO",
  },
  {
    memberId: "M-10003",
    firstName: "Maria",
    lastName: "Garcia",
    dateOfBirth: "Not Provided",
    planId: "PLAN-GOLD-A",
    planName: "Gold PPO",
  },
];

const CLAIMS: Claim[] = [
  {
    claimId: "CLM-50001",
    memberId: "M-10001",
    providerId: "PRV-200",
    providerName: "Dr. Emily Chen — Family Medicine",
    serviceDate: "Recent",
    amount: 245.0,
    status: "approved",
    diagnosisCode: "J06.9",
    procedureCode: "99213",
  },
  {
    claimId: "CLM-50002",
    memberId: "M-10001",
    providerId: "PRV-301",
    providerName: "City Lab Diagnostics",
    serviceDate: "Recent",
    amount: 89.5,
    status: "in_review",
    diagnosisCode: "R73.03",
    procedureCode: "80053",
  },
  {
    claimId: "CLM-50003",
    memberId: "M-10002",
    providerId: "PRV-400",
    providerName: "Northside Orthopedics",
    serviceDate: "Recent",
    amount: 1200.0,
    status: "denied",
    diagnosisCode: "M54.5",
    procedureCode: "27447",
  },
  {
    claimId: "CLM-50004",
    memberId: "M-10003",
    providerId: "PRV-200",
    providerName: "Dr. Emily Chen — Family Medicine",
    serviceDate: "Recent",
    amount: 175.0,
    status: "submitted",
    diagnosisCode: "J45.20",
    procedureCode: "99214",
  },
];

const PRESCRIPTIONS: Prescription[] = [
  {
    prescriptionId: "RX-70001",
    memberId: "M-10001",
    medicationName: "Lisinopril 10mg",
    dosage: "1 tablet daily",
    lastFilledDate: "Recent",
    refillsRemaining: 3,
    prescriptionStatus: "active",
    refillStatus: "eligible",
    refillStatusReason: "REFILL_AVAILABLE",
    pendingRefillRequestedAt: null,
  },
  {
    prescriptionId: "RX-70002",
    memberId: "M-10001",
    medicationName: "Metformin 500mg",
    dosage: "1 tablet twice daily",
    lastFilledDate: "Recent",
    refillsRemaining: 5,
    prescriptionStatus: "active",
    refillStatus: "pending",
    refillStatusReason: "ALREADY_PENDING",
    pendingRefillRequestedAt: "2026-06-04T10:00:00.000Z",
  },
  {
    prescriptionId: "RX-70003",
    memberId: "M-10001",
    medicationName: "Atorvastatin 20mg",
    dosage: "1 tablet at bedtime",
    lastFilledDate: "Recent",
    refillsRemaining: 0,
    prescriptionStatus: "active",
    refillStatus: "ineligible",
    refillStatusReason: "NO_REFILLS_REMAINING",
    pendingRefillRequestedAt: null,
  },
  {
    prescriptionId: "RX-70004",
    memberId: "M-10002",
    medicationName: "Omeprazole 20mg",
    dosage: "1 capsule before breakfast",
    lastFilledDate: "Recent",
    refillsRemaining: 2,
    prescriptionStatus: "active",
    refillStatus: "processing",
    refillStatusReason: "ALREADY_PROCESSING",
    pendingRefillRequestedAt: "2026-06-04T09:30:00.000Z",
  },
  {
    prescriptionId: "RX-70005",
    memberId: "M-10003",
    medicationName: "Albuterol HFA Inhaler",
    dosage: "2 puffs every 4-6 hours as needed",
    lastFilledDate: "Recent",
    refillsRemaining: 4,
    prescriptionStatus: "active",
    refillStatus: "eligible",
    refillStatusReason: "REFILL_AVAILABLE",
    pendingRefillRequestedAt: null,
  },
];

const REFILL_REQUESTS: RefillRequest[] = [
  {
    refillRequestId: "RFL-90001",
    prescriptionId: "RX-70002",
    memberId: "M-10001",
    status: "pending",
    requestedAt: "2026-06-04T10:00:00.000Z",
    updatedAt: "2026-06-04T10:00:00.000Z",
    canceledAt: null,
    downstreamReference: "DSP-10001",
  },
  {
    refillRequestId: "RFL-90002",
    prescriptionId: "RX-70004",
    memberId: "M-10002",
    status: "processing",
    requestedAt: "2026-06-04T09:30:00.000Z",
    updatedAt: "2026-06-04T09:35:00.000Z",
    canceledAt: null,
    downstreamReference: "DSP-10002",
  },
];

// ─── Data Access Functions ───────────────────────────────────────────────────

export function getMember(memberId: string): Member | undefined {
  return MEMBERS.find((m) => m.memberId === memberId);
}

export function getClaimsForMember(memberId: string): Claim[] {
  return CLAIMS.filter((c) => c.memberId === memberId);
}

export function getClaim(claimId: string, memberId: string): Claim | undefined {
  return CLAIMS.find((c) => c.claimId === claimId && c.memberId === memberId);
}

export function getActivePrescriptions(memberId: string): Prescription[] {
  return PRESCRIPTIONS.filter(
    (p) => p.memberId === memberId && p.prescriptionStatus === "active"
  );
}

export function getPrescription(
  prescriptionId: string,
  memberId: string
): Prescription | undefined {
  return PRESCRIPTIONS.find(
    (p) => p.prescriptionId === prescriptionId && p.memberId === memberId
  );
}

export function getPrescriptionById(
  prescriptionId: string
): Prescription | undefined {
  return PRESCRIPTIONS.find((prescription) => prescription.prescriptionId === prescriptionId);
}

export function getRefillRequest(
  prescriptionId: string,
  memberId: string
): RefillRequest | undefined {
  return REFILL_REQUESTS.find(
    (request) =>
      request.prescriptionId === prescriptionId &&
      request.memberId === memberId &&
      request.status !== "canceled"
  );
}

function syncPrescriptionRefillState(
  prescription: Prescription,
  refillRequest: RefillRequest | undefined
): void {
  if (prescription.prescriptionStatus !== "active") {
    prescription.refillStatus = "ineligible";
    prescription.refillStatusReason = "PRESCRIPTION_INACTIVE";
    prescription.pendingRefillRequestedAt = null;
    return;
  }

  if (refillRequest?.status === "pending") {
    prescription.refillStatus = "pending";
    prescription.refillStatusReason = "ALREADY_PENDING";
    prescription.pendingRefillRequestedAt = refillRequest.requestedAt;
    return;
  }

  if (refillRequest?.status === "processing") {
    prescription.refillStatus = "processing";
    prescription.refillStatusReason = "ALREADY_PROCESSING";
    prescription.pendingRefillRequestedAt = refillRequest.requestedAt;
    return;
  }

  prescription.pendingRefillRequestedAt = null;
  if (prescription.refillsRemaining > 0) {
    prescription.refillStatus = "eligible";
    prescription.refillStatusReason = "REFILL_AVAILABLE";
  } else {
    prescription.refillStatus = "ineligible";
    prescription.refillStatusReason = "NO_REFILLS_REMAINING";
  }
}

export function requestRefill(
  prescriptionId: string,
  memberId: string
): RefillMutationResult {
  const prescription = getPrescription(prescriptionId, memberId);
  if (!prescription) {
    throw new AppError(404, "NotFound", "Prescription not found.");
  }

  const existingRefill = getRefillRequest(prescriptionId, memberId);
  syncPrescriptionRefillState(prescription, existingRefill);

  if (prescription.refillStatus === "pending") {
    return {
      success: true,
      refillStatus: "pending",
      message: "Your refill request is already pending.",
      code: "REFILL_ALREADY_PENDING",
      duplicate: true,
    };
  }

  if (prescription.refillStatus === "processing") {
    throw new AppError(
      409,
      "Conflict",
      "This refill is already being processed.",
      "REFILL_ALREADY_PROCESSING"
    );
  }

  if (prescription.refillStatus === "ineligible") {
    throw new AppError(
      422,
      "UnprocessableEntity",
      "This prescription is not eligible for refill.",
      "REFILL_INELIGIBLE"
    );
  }

  const now = new Date().toISOString();
  REFILL_REQUESTS.push({
    refillRequestId: `RFL-${Date.now()}`,
    prescriptionId,
    memberId,
    status: "pending",
    requestedAt: now,
    updatedAt: now,
    canceledAt: null,
    downstreamReference: null,
  });
  syncPrescriptionRefillState(prescription, getRefillRequest(prescriptionId, memberId));

  return {
    success: true,
    refillStatus: "pending",
    message: "Refill request submitted.",
    code: "REFILL_PENDING",
    duplicate: false,
  };
}

export function cancelRefill(
  prescriptionId: string,
  memberId: string
): RefillMutationResult {
  const prescription = getPrescription(prescriptionId, memberId);
  if (!prescription) {
    throw new AppError(404, "NotFound", "Prescription not found.");
  }

  const refillRequest = getRefillRequest(prescriptionId, memberId);
  syncPrescriptionRefillState(prescription, refillRequest);

  if (!refillRequest) {
    throw new AppError(
      422,
      "UnprocessableEntity",
      "There is no pending refill to cancel.",
      "REFILL_NOT_PENDING"
    );
  }

  if (refillRequest.status === "processing") {
    throw new AppError(
      409,
      "Conflict",
      "This refill can no longer be changed.",
      "REFILL_ALREADY_PROCESSING"
    );
  }

  const now = new Date().toISOString();
  refillRequest.status = "canceled";
  refillRequest.updatedAt = now;
  refillRequest.canceledAt = now;
  syncPrescriptionRefillState(prescription, undefined);

  return {
    success: true,
    refillStatus: prescription.refillStatus === "eligible" ? "eligible" : "pending",
    message: "Pending refill canceled.",
    code: "REFILL_CANCELED",
    duplicate: false,
  };
}
