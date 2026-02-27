// next-auth.d.ts
import NextAuth, { type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { UserRole, EmployeeClassification } from "@prisma/client";

// Define the structure for a user's department
export interface UserDepartment {
  id: string;
  name: string;
}

// Define the structure for a user's business unit
export interface UserBusinessUnit {
  id: string;
  name: string;
  code: string;
}

declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      employeeId: string;
      email: string | null;
      name: string;
      role: UserRole; // Uses the UserRole enum from Prisma
      classification: EmployeeClassification | null; // Uses the EmployeeClassification enum from Prisma
      businessUnit: UserBusinessUnit | null;
      department: UserDepartment | null;
      isAcctg: boolean | null;
      isPurchaser: boolean | null;
      isRDHMRS: boolean | null;
    } & Omit<DefaultSession["user"], "email" | "name">;
  }

  interface User {
    id: string;
    employeeId: string;
    email: string | null;
    name: string;
    role: UserRole;
    classification: EmployeeClassification | null;
    businessUnit: UserBusinessUnit | null;
    department: UserDepartment | null;
    isAcctg: boolean | null;
    isPurchaser: boolean | null;
    isRDHMRS: boolean | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    employeeId: string;
    email: string | null;
    name: string;
    role: UserRole;
    classification: EmployeeClassification | null;
    businessUnit: UserBusinessUnit | null;
    department: UserDepartment | null;
    isAcctg: boolean | null;
    isPurchaser: boolean | null;
    isRDHMRS: boolean | null;
    sessionToken?: string; // For hybrid session tracking
  }
}