import { z } from "zod";

export const prescriptionIdParamsSchema = z.object({
	prescriptionId: z.string().min(1),
});