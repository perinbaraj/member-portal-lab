import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../server/server.js";

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
  });
});
