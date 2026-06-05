import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../server/server.js";
import { getPriorAuthAuditEventsForRequest } from "../server/data.js";

describe("GET /health", () => {
  it("returns ok without auth", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/members/me", () => {
  it("returns 401 without auth header", async () => {
    const res = await request(app).get("/api/members/me");
    expect(res.status).toBe(401);
  });

  it("returns member profile with valid auth", async () => {
    const res = await request(app)
      .get("/api/members/me")
      .set("x-member-id", "M-10001");
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("Sarah");
    expect(res.body.planName).toBe("Gold PPO");
  });

  it("returns 404 for unknown member", async () => {
    const res = await request(app)
      .get("/api/members/me")
      .set("x-member-id", "M-99999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/claims", () => {
  it("returns claims for member", async () => {
    const res = await request(app)
      .get("/api/claims")
      .set("x-member-id", "M-10001");
    expect(res.status).toBe(200);
    expect(res.body.claims.length).toBeGreaterThan(0);
  });
});

describe("GET /api/prescriptions", () => {
  it("returns prescriptions for member", async () => {
    const res = await request(app)
      .get("/api/prescriptions")
      .set("x-member-id", "M-10001");
    expect(res.status).toBe(200);
    expect(res.body.prescriptions.length).toBeGreaterThan(0);
    expect(res.body.prescriptions[0].refillStatus).toBeDefined();
  });

  it("returns 401 without member context", async () => {
    const res = await request(app).get("/api/prescriptions");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Missing member context.");
  });

  it("returns an empty list for a member without active prescriptions", async () => {
    const res = await request(app)
      .get("/api/prescriptions")
      .set("x-member-id", "M-99999");
    expect(res.status).toBe(200);
    expect(res.body.prescriptions).toEqual([]);
  });
});

describe("POST /api/prescriptions/:prescriptionId/refill", () => {
  it("submits a refill request for an eligible prescription", async () => {
    const res = await request(app)
      .post("/api/prescriptions/RX-70001/refill")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.refillStatus).toBe("pending");
  });

  it("collapses a duplicate refill request safely", async () => {
    const res = await request(app)
      .post("/api/prescriptions/RX-70002/refill")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(202);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.code).toBe("REFILL_ALREADY_PENDING");
  });

  it("rejects ineligible refill requests", async () => {
    const res = await request(app)
      .post("/api/prescriptions/RX-70003/refill")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("REFILL_INELIGIBLE");
  });

  it("does not allow another member to request a refill for someone else's prescription", async () => {
    const res = await request(app)
      .post("/api/prescriptions/RX-70005/refill")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

describe("DELETE /api/prescriptions/:prescriptionId/refill", () => {
  it("cancels a pending refill", async () => {
    const res = await request(app)
      .delete("/api/prescriptions/RX-70002/refill")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.refillStatus).toBe("eligible");
  });

  it("returns a conflict when a refill is already processing", async () => {
    const res = await request(app)
      .delete("/api/prescriptions/RX-70004/refill")
      .set("x-member-id", "M-10002");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("REFILL_ALREADY_PROCESSING");
  });

  it("returns an error when there is no pending refill", async () => {
    const res = await request(app)
      .delete("/api/prescriptions/RX-70005/refill")
      .set("x-member-id", "M-10003");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("REFILL_NOT_PENDING");
  });
});

describe("GET /api/prior-auth", () => {
  it("returns member-scoped prior authorization requests", async () => {
    const res = await request(app)
      .get("/api/prior-auth")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
    expect(res.body.requests.some((request: { requestId: string }) => request.requestId === "PAR-10001")).toBe(true);
    expect(res.body.requests.some((request: { requestId: string }) => request.requestId === "PAR-20001")).toBe(false);
  });

  it("supports pagination query values", async () => {
    const res = await request(app)
      .get("/api/prior-auth?page=1&limit=1")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.requests.length).toBeLessThanOrEqual(1);
  });

  it("returns 401 without member context", async () => {
    const res = await request(app).get("/api/prior-auth");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/prior-auth/:requestId", () => {
  it("returns request details for owned request", async () => {
    const res = await request(app)
      .get("/api/prior-auth/PAR-10001")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe("PAR-10001");
  });

  it("rejects cross-member access attempts", async () => {
    const res = await request(app)
      .get("/api/prior-auth/PAR-20001")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns denied details with allowed reason code", async () => {
    const res = await request(app)
      .get("/api/prior-auth/PAR-10002")
      .set("x-member-id", "M-10001");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("denied");
    expect([
      "medical_necessity",
      "missing_documentation",
      "non_covered_service",
      "eligibility_issue",
      "duplicate_request",
      "other",
    ]).toContain(res.body.denialReasonCode);
    expect(res.body.appealInstructions).toBeTruthy();
  });
});

describe("POST /api/prior-auth", () => {
  it("creates a new request in pending status", async () => {
    const res = await request(app)
      .post("/api/prior-auth")
      .set("x-member-id", "M-10003")
      .send({
        procedureCode: "77067",
        referringProvider: "Dr. Brown",
        clinicalJustification: "Follow-up imaging based on prior findings.",
        preferredFacility: "City Imaging",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.requestId).toMatch(/^PAR-/);
  });

  it("rejects invalid payloads", async () => {
    const res = await request(app)
      .post("/api/prior-auth")
      .set("x-member-id", "M-10001")
      .send({
        procedureCode: "12345",
        referringProvider: "Dr. House",
        clinicalJustification: "x".repeat(501),
        preferredFacility: "Main Facility",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("rejects requests when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/prior-auth")
      .set("x-member-id", "M-10001")
      .send({
        procedureCode: "77067",
        clinicalJustification: "Clinical rationale present but provider and facility are omitted.",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("creates an immutable transition audit event for request creation", async () => {
    const createResponse = await request(app)
      .post("/api/prior-auth")
      .set("x-member-id", "M-10002")
      .send({
        procedureCode: "99214",
        referringProvider: "Dr. Vega",
        clinicalJustification: "Ongoing symptoms requiring specialist procedure approval.",
        preferredFacility: "Downtown Specialty Clinic",
      });

    expect(createResponse.status).toBe(201);

    const events = getPriorAuthAuditEventsForRequest(createResponse.body.requestId, "M-10002");
    expect(events.length).toBeGreaterThan(0);
    expect(events.at(-1)?.toStatus).toBe("pending");
    expect(events.at(-1)?.fromStatus).toBeNull();
  });
});
