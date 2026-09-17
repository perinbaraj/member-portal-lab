import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { getMember, getClaimsForMember, getClaim } from "./data.js";
import { prescriptionsRouter } from "./routes/prescriptions.js";
import { priorAuthRouter } from "./routes/priorAuth.js";
import "./types.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Health check (no auth) ──────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Auth middleware ─────────────────────────────────────────────────────────

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const memberId =
    (req.headers["x-member-id"] as string) || process.env.DEV_MEMBER_ID;

  if (!memberId) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing member context.",
    });
    return;
  }

  req.auth = { memberId, email: `${memberId}@member.local`, roles: ["member"] };
  next();
}

app.use("/api", authMiddleware);

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/members/me
app.get("/api/members/me", (req: Request, res: Response) => {
  const member = getMember(req.auth!.memberId);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(member);
});

// GET /api/claims
app.get("/api/claims", (req: Request, res: Response) => {
  const claims = getClaimsForMember(req.auth!.memberId);
  res.json({ claims });
});

// GET /api/claims/:claimId
app.get("/api/claims/:claimId", (req: Request, res: Response) => {
  const claim = getClaim(req.params.claimId as string, req.auth!.memberId);
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(claim);
});

app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/prior-auth", priorAuthRouter);

// TODO: POST /api/prescriptions/:id/refill — Lab exercise
// TODO: POST /api/claims/:claimId/appeal — Lab exercise

// ─── Serve frontend in production ────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(import.meta.dirname ?? ".", "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ API running → http://localhost:${PORT}`);
});

export { app };
