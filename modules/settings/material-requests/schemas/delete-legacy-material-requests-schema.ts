import { z } from "zod"

export const legacyMaterialRequestDeleteConfirmationPhrase = "DELETE LEGACY MATERIAL REQUESTS"

export const deleteLegacyMaterialRequestsInputSchema = z
  .object({
    companyId: z.string().uuid(),
    confirmationText: z.string().trim().min(1, "Confirmation text is required."),
  })
  .refine((value) => value.confirmationText === legacyMaterialRequestDeleteConfirmationPhrase, {
    message: `Type "${legacyMaterialRequestDeleteConfirmationPhrase}" to confirm deletion.`,
    path: ["confirmationText"],
  })

export type DeleteLegacyMaterialRequestsInput = z.infer<typeof deleteLegacyMaterialRequestsInputSchema>
