import { z } from "zod";

export const denialReasonCodeSchema = z.enum([
  "medical_necessity",
  "missing_documentation",
  "non_covered_service",
  "eligibility_issue",
  "duplicate_request",
  "other",
]);

export const priorAuthStatusSchema = z.enum([
  "pending",
  "approved",
  "denied",
  "expired",
]);

export const priorAuthRequestIdParamsSchema = z.object({
  requestId: z.string().min(1),
});

export const priorAuthListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPriorAuthRequestBodySchema = z.object({
  procedureCode: z.string().trim().min(1).max(32),
  referringProvider: z.string().trim().min(1).max(120),
  clinicalJustification: z.string().trim().min(1).max(500),
  preferredFacility: z.string().trim().min(1).max(120),
});
