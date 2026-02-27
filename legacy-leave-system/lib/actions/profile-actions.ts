"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success?: string; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    // Only allow users to reset their own password, or admins to reset any password
    if (session.user.id !== userId && session.user.role !== "ADMIN") {
      return { error: "Unauthorized to reset this password" };
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return { error: "Password must be at least 8 characters long" };
    }

    // Hash the password before storing
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the password with hashed version
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: "Password reset successfully" };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { error: "Failed to reset password" };
  }
}

export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    bio?: string;
  }
): Promise<{ success?: string; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    // Only allow users to update their own profile
    if (session.user.id !== userId) {
      return { error: "Unauthorized to update this profile" };
    }

    // Update the user profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        // Note: phone, address, bio would need to be added to the User model
        // For now, we'll just update the basic fields
      },
    });

    return { success: "Profile updated successfully" };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { error: "Failed to update profile" };
  }
}