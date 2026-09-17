import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../types.js";
import { PriorAuthService } from "../services/priorAuthService.js";
import {
  createPriorAuthRequestBodySchema,
  priorAuthListQuerySchema,
  priorAuthRequestIdParamsSchema,
} from "../validation/priorAuth.js";

export const priorAuthRouter = Router();

const priorAuthService = new PriorAuthService();

function hashMemberId(memberId: string): string {
  let hash = 0;
  for (const character of memberId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16);
}

function logSecurityEvent(memberId: string, action: string): void {
  console.warn(`[security] member=${hashMemberId(memberId)} action=${action}`);
}

function handleRouteError(error: unknown, res: Response): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "BadRequest",
      message: "Please check the request input and try again.",
      code: "VALIDATION_FAILED",
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode === 403 && res.req?.auth?.memberId) {
      logSecurityEvent(res.req.auth.memberId, "cross-member-prior-auth-access");
    }

    res.status(error.statusCode).json({
      error: error.error,
      message: error.message,
      code: error.code,
    });
    return;
  }

  res.status(503).json({
    error: "ServiceUnavailable",
    message: "We couldn't process your request. Please try again.",
  });
}

priorAuthRouter.get("/", (req: Request, res: Response) => {
  try {
    const { page, limit } = priorAuthListQuerySchema.parse(req.query);
    const result = priorAuthService.list(req.auth!.memberId, page, limit);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res);
  }
});

priorAuthRouter.get("/:requestId", (req: Request, res: Response) => {
  try {
    const { requestId } = priorAuthRequestIdParamsSchema.parse(req.params);
    const request = priorAuthService.getById(req.auth!.memberId, requestId);
    res.json(request);
  } catch (error) {
    handleRouteError(error, res);
  }
});

priorAuthRouter.post("/", (req: Request, res: Response) => {
  try {
    const input = createPriorAuthRequestBodySchema.parse(req.body);
    const created = priorAuthService.create(req.auth!.memberId, input);
    res.status(201).json(created);
  } catch (error) {
    handleRouteError(error, res);
  }
});
