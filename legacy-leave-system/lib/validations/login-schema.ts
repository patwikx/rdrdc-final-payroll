import * as z from "zod";

export const LoginSchema = z.object({
  employeeId: z.string().min(1, {
    message: "Employee ID is required",
  }),
  password: z.string().min(1, {
    message: "Password is required",
  }),
  code: z.optional(z.string()),
});
