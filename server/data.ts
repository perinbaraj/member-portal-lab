import { Member, Prescription, Claim } from "./types.js";

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
    status: "active",
  },
  {
    prescriptionId: "RX-70002",
    memberId: "M-10001",
    medicationName: "Metformin 500mg",
    dosage: "1 tablet twice daily",
    lastFilledDate: "Recent",
    refillsRemaining: 5,
    status: "active",
  },
  {
    prescriptionId: "RX-70003",
    memberId: "M-10001",
    medicationName: "Atorvastatin 20mg",
    dosage: "1 tablet at bedtime",
    lastFilledDate: "Recent",
    refillsRemaining: 0,
    status: "active",
  },
  {
    prescriptionId: "RX-70004",
    memberId: "M-10002",
    medicationName: "Omeprazole 20mg",
    dosage: "1 capsule before breakfast",
    lastFilledDate: "Recent",
    refillsRemaining: 2,
    status: "active",
  },
  {
    prescriptionId: "RX-70005",
    memberId: "M-10003",
    medicationName: "Albuterol HFA Inhaler",
    dosage: "2 puffs every 4-6 hours as needed",
    lastFilledDate: "Recent",
    refillsRemaining: 4,
    status: "active",
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
    (p) => p.memberId === memberId && p.status === "active"
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
