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
  status: "active" | "expired" | "discontinued";
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
