import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { LoginSchema } from "@/lib/validations/login-schema";
import { getUserByUsername } from "@/lib/auth-actions/auth-users";

export const authConfig = {
  providers: [
    Credentials({
      async authorize(credentials) {
        const validatedFields = LoginSchema.safeParse(credentials);
        
        if (validatedFields.success) {
          const { employeeId, password } = validatedFields.data;
          const user = await getUserByUsername(employeeId);
          
          if (!user || !user.password) return null;
          
          // Check if user account is active
          if (user.isActive === false) {
            throw new Error("Your account has been deactivated. Please contact your administrator.");
          }
          
          const passwordsMatch = await bcryptjs.compare(
            password,
            user.password
          );
         
          if (passwordsMatch) {
            // Return user in format matching your Prisma schema
            return {
              id: user.id,
              employeeId: user.employeeId,
              email: user.email,
              name: user.name,
              role: user.role,
              classification: user.classification,
              businessUnit: user.businessUnit || null,
              department: user.department || null,
              isAcctg: user.isAcctg || null,
              isPurchaser: user.isPurchaser || null,
              isRDHMRS: user.isRDHMRS || null,
            };
          }
        }
        return null;
      },
    }),
  ],
} satisfies NextAuthConfig;