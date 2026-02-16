import { z } from "zod"

const userNameSchema = z.string().trim().min(1, "This field is required.").max(100, "Maximum length is 100 characters.")
const userEmailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address.")
  .max(320, "Maximum length is 320 characters.")
const passwordSchema = z.string().min(8, "Password must be at least 8 characters.").max(128, "Password is too long.")

export const updateOwnProfileInputSchema = z.object({
  companyId: z.string().uuid(),
  firstName: userNameSchema,
  lastName: userNameSchema,
  email: userEmailSchema,
})

export const changeOwnPasswordInputSchema = z
  .object({
    companyId: z.string().uuid(),
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "New password and confirmation do not match.",
      })
    }

    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be different from your current password.",
      })
    }
  })

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileInputSchema>
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordInputSchema>
