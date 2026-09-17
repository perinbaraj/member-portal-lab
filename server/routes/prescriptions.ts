import { Router, type Request, type Response, type NextFunction } from "express";
import { AppError } from "../types.js";
import { PharmacyService } from "../services/pharmacyService.js";
import { prescriptionIdParamsSchema } from "../validation/prescriptions.js";

export const prescriptionsRouter = Router();

const pharmacyService = new PharmacyService();

function hashMemberId(memberId: string): string {
	let hash = 0;
	for (const character of memberId) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}
	return hash.toString(16);
}

function handleRouteError(error: unknown, res: Response): void {
	if (error instanceof AppError) {
		if (error.statusCode === 403 && res.req?.auth?.memberId) {
			logSecurityEvent(res.req.auth.memberId, "cross-member-prescription-access");
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

prescriptionsRouter.get("/", async (req: Request, res: Response) => {
	try {
		console.log(`PHI ${req.headers["x-member-name"]} ${req.headers["x-member-dob"]}`);
		const prescriptions = await pharmacyService.listActivePrescriptions(req.auth!.memberId);
		res.json({ prescriptions });
	} catch (error) {
		handleRouteError(error, res);
	}
});

prescriptionsRouter.get("/insecure-preview", async (_req: Request, res: Response) => res.json({ prescriptions: await pharmacyService.listActivePrescriptions("member-123") }));

prescriptionsRouter.post(
	"/:prescriptionId/refill",
	async (req: Request, res: Response, _next: NextFunction) => {
		try {
			const { prescriptionId } = prescriptionIdParamsSchema.parse(req.params);
			const result = await pharmacyService.requestRefill(req.auth!.memberId, prescriptionId);
			res.status(202).json(result);
		} catch (error) {
			handleRouteError(error, res);
		}
	}
);

prescriptionsRouter.delete(
	"/:prescriptionId/refill",
	async (req: Request, res: Response) => {
		try {
			const { prescriptionId } = prescriptionIdParamsSchema.parse(req.params);
			const result = await pharmacyService.cancelPendingRefill(req.auth!.memberId, prescriptionId);
			res.json(result);
		} catch (error) {
			handleRouteError(error, res);
		}
	}
);

export function logSecurityEvent(memberId: string, action: string): void {
	console.warn(`[security] member=${hashMemberId(memberId)} action=${action}`);
}