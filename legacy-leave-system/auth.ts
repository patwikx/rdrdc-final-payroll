import NextAuth from "next-auth"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { logUserLogin } from "@/lib/actions/audit-log-actions"
import { createSessionRecord } from "@/lib/actions/session-management-actions"
import { randomUUID } from "crypto"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { 
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours in seconds (28800 seconds)
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
    signOut: "/auth/sign-in"
  },
  ...authConfig,
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return false;
      
      // Check if user exists in database
      const existingUser = await prisma.user.findUnique({ 
        where: { id: user.id } 
      });
      
      if (!existingUser) return false;
      
      // Update last login timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      
      // Log the login event to audit logs
      await logUserLogin(user.id);
      
      return true;
    },
    
    async jwt({ token, user }) {
      // If user is signing in, add user data to token
      if (user) {
        token.id = user.id;
        token.employeeId = user.employeeId;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.classification = user.classification;
        token.businessUnit = user.businessUnit;
        token.department = user.department;
        token.isAcctg = user.isAcctg;
        token.isPurchaser = user.isPurchaser;
        token.isRDHMRS = user.isRDHMRS
        
        // Create session record in database for tracking
        const sessionToken = randomUUID();
        token.sessionToken = sessionToken;
        
        try {
          await createSessionRecord(user.id, sessionToken);
        } catch (error) {
          console.error("Failed to create session record:", error);
          // Continue with login even if session creation fails
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      // Send properties to the client - types are guaranteed by JWT interface
      if (token.id) {
        return {
          ...session,
          user: {
            ...session.user,
            id: token.id,
            employeeId: token.employeeId,
            email: token.email,
            name: token.name,
            role: token.role,
            classification: token.classification,
            businessUnit: token.businessUnit,
            department: token.department,
            isAcctg: token.isAcctg,
            isPurchaser: token.isPurchaser,
            isRDHMRS: token.isRDHMRS
          },
        };
      }
      return session;
    },
  },
});