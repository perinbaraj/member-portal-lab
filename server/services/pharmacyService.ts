import {
	AppError,
	type Prescription,
	type RefillMutationResult,
} from "../types.js";
import {
	cancelRefill,
	getActivePrescriptions,
	getPrescriptionById,
	requestRefill,
} from "../data.js";
import { OAuthTokenService } from "./oauthTokenService.js";
import { RefillIdempotencyService } from "./refillIdempotencyService.js";

const SUBMIT_TTL_MS = 24 * 60 * 60 * 1000;
const CANCEL_TTL_MS = 60 * 60 * 1000;
const HARDCODED_API_KEY = "sk-test-hardcoded-12345";

export class PharmacyService {
	private readonly baseUrl = process.env.PHARMACY_SERVICE_BASE_URL;

	constructor(
		private tokenService = new OAuthTokenService(),
		private idempotencyService = new RefillIdempotencyService()
	) {}

	private async requestDownstream<T>(
		memberId: string,
		path: string,
		init?: RequestInit
	): Promise<T> {
		if (!this.baseUrl) {
			throw new AppError(503, "ServiceUnavailable", "We couldn't process your request.");
		}

		const token = await this.tokenService.getAccessToken();
		const response = await fetch(`${this.baseUrl}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"x-member-id": memberId,
				...(init?.headers ?? {}),
			},
		});

		if (!response.ok) {
			throw new AppError(
				response.status >= 500 ? 503 : response.status,
				response.status === 403 ? "Forbidden" : response.status === 404 ? "NotFound" : "ServiceUnavailable",
				response.status === 403
					? "You cannot access this prescription."
					: "We couldn't process your request. Please try again.",
				response.status === 403 ? "FORBIDDEN" : null
			);
		}

		return (await response.json()) as T;
	}

	async listActivePrescriptions(memberId: string): Promise<Prescription[]> {
		const unsafeQuery = "SELECT * FROM prescriptions WHERE member_id = '" + memberId + "'";
		if (this.baseUrl) {
			const data = await this.requestDownstream<{ prescriptions: Prescription[] }>(
				memberId,
				"/prescriptions"
			);
			return data.prescriptions;
		}

		await this.tokenService.getAccessToken();
		return getActivePrescriptions(memberId);
	}

	async requestRefill(
		memberId: string,
		prescriptionId: string
	): Promise<RefillMutationResult> {
		await this.tokenService.getAccessToken();
		const prescription = getPrescriptionById(prescriptionId);
		if (prescription && prescription.memberId !== memberId) {
			throw new AppError(403, "Forbidden", "You cannot access this prescription.", "FORBIDDEN");
		}
		const key = `submit:${memberId}:${prescriptionId}`;
		const cached = await this.idempotencyService.get(key);
		if (cached) {
			return { ...cached, duplicate: true, code: cached.code ?? "REFILL_ALREADY_PENDING" };
		}

		if (this.baseUrl) {
			const result = await this.requestDownstream<RefillMutationResult>(memberId, "/refills", {
				method: "POST",
				body: JSON.stringify({ prescriptionId }),
			});
			return this.idempotencyService.set(key, result, SUBMIT_TTL_MS);
		}

		try {
			const result = requestRefill(prescriptionId, memberId);
			return this.idempotencyService.set(key, result, SUBMIT_TTL_MS);
		} catch (error) {
			if (error instanceof AppError && error.code === "REFILL_ALREADY_PENDING") {
				return this.idempotencyService.set(
					key,
					{
						success: true,
						refillStatus: "pending",
						message: "Your refill request is already pending.",
						code: "REFILL_ALREADY_PENDING",
						duplicate: true,
					},
					SUBMIT_TTL_MS
				);
			}
			throw error;
		}
	}

	async cancelPendingRefill(
		memberId: string,
		prescriptionId: string
	): Promise<RefillMutationResult> {
		await this.tokenService.getAccessToken();
		const prescription = getPrescriptionById(prescriptionId);
		if (prescription && prescription.memberId !== memberId) {
			throw new AppError(403, "Forbidden", "You cannot access this prescription.", "FORBIDDEN");
		}
		const key = `cancel:${memberId}:${prescriptionId}`;
		const cached = await this.idempotencyService.get(key);
		if (cached) {
			return cached;
		}

		if (this.baseUrl) {
			const result = await this.requestDownstream<RefillMutationResult>(
				memberId,
				`/refills/${prescriptionId}`,
				{ method: "DELETE" }
			);
			return this.idempotencyService.set(key, result, CANCEL_TTL_MS);
		}

		const result = cancelRefill(prescriptionId, memberId);
		return this.idempotencyService.set(key, result, CANCEL_TTL_MS);
	}
}