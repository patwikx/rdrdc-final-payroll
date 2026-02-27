"use server";

import * as z from "zod";
import { AuthError } from "next-auth";


import { getUserByUsername } from "./auth-users";
import { LoginSchema } from "../validations/login-schema";
import { signIn } from "../../auth";

export const login = async (
  values: z.infer<typeof LoginSchema>,
) => {
  const validatedFields = LoginSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Invalid fields!" };
  }

  const { employeeId, password } = validatedFields.data;

  const existingUser = await getUserByUsername(employeeId);

  if (!existingUser || !existingUser.employeeId || !existingUser.password) {
    return { error: "Employee ID does not exist!" }
  }

  try {
    await signIn("credentials", {
      employeeId,
      password,
      redirectTo: existingUser.businessUnit ? `/${existingUser.businessUnit.id}` : "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials!" }
        default:
          return { error: "Something went wrong!" }
      }
    }

    throw error;
  }
};

export const loginAction = async (
  _prevState: string | undefined,
  formData: FormData,
) => {
  const employeeId = formData.get("employeeId") as string;
  const password = formData.get("password") as string;

  const validatedFields = LoginSchema.safeParse({
    employeeId,
    password,
  });

  if (!validatedFields.success) {
    return "Invalid fields!";
  }

  const { employeeId: validEmployeeId, password: validPassword } = validatedFields.data;

  const existingUser = await getUserByUsername(validEmployeeId);

  if (!existingUser || !existingUser.employeeId || !existingUser.password) {
    return "Employee ID does not exist!";
  }

  try {
    await signIn("credentials", {
      employeeId: validEmployeeId,
      password: validPassword,
      redirectTo: existingUser.businessUnit ? `/${existingUser.businessUnit.id}` : "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials!";
        default:
          return "Something went wrong!";
      }
    }

    throw error;
  }
};