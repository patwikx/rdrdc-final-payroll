"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as z from "zod";

// Schema for leave request
const LeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  session: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]),
  reason: z.string().min(1, "Reason is required"),
});

// Schema for overtime request
const OvertimeRequestSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  reason: z.string().min(1, "Reason is required"),
});

// Get leave types for dropdown
export async function getLeaveTypes() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return leaveTypes;
  } catch (error) {
    console.error("Get leave types error:", error);
    return [];
  }
}

// Submit leave request
export async function submitLeaveRequest(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Not authenticated" };
    }

    const validatedFields = LeaveRequestSchema.safeParse({
      leaveTypeId: formData.get("leaveTypeId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      session: formData.get("session"),
      reason: formData.get("reason"),
    });

    if (!validatedFields.success) {
      return { error: "Invalid fields!" };
    }

    const { leaveTypeId, startDate, endDate, session: leaveSession, reason } = validatedFields.data;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return { error: "End date must be after start date" };
    }

    // Check if leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId }
    });

    if (!leaveType) {
      return { error: "Invalid leave type" };
    }

    // Create leave request
    await prisma.leaveRequest.create({
      data: {
        userId: session.user.id,
        leaveTypeId,
        startDate: start,
        endDate: end,
        session: leaveSession,
        reason,
        status: "PENDING_MANAGER",
      },
    });

    revalidatePath(`/${session.user.businessUnit?.id}`);
    return { success: "Leave request submitted successfully!" };
  } catch (error) {
    console.error("Submit leave request error:", error);
    return { error: "Failed to submit leave request" };
  }
}

// Submit overtime request
export async function submitOvertimeRequest(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Not authenticated" };
    }

    const validatedFields = OvertimeRequestSchema.safeParse({
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      reason: formData.get("reason"),
    });

    if (!validatedFields.success) {
      return { error: "Invalid fields!" };
    }

    const { startTime, endTime, reason } = validatedFields.data;

    // Parse date and time components to create UTC dates without timezone conversion
    // Input format: "YYYY-MM-DDTHH:MM"
    const parseAsUTC = (dateTimeStr: string): Date => {
      const [datePart, timePart] = dateTimeStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Create date using UTC methods to avoid timezone conversion
      return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
    };

    const start = parseAsUTC(startTime);
    const end = parseAsUTC(endTime);
    
    if (start >= end) {
      return { error: "End time must be after start time" };
    }

    // Create overtime request
    await prisma.overtimeRequest.create({
      data: {
        userId: session.user.id,
        startTime: start,
        endTime: end,
        reason,
        status: "PENDING_MANAGER",
      },
    });

    revalidatePath(`/${session.user.businessUnit?.id}`);
    return { success: "Overtime request submitted successfully!" };
  } catch (error) {
    console.error("Submit overtime request error:", error);
    return { error: "Failed to submit overtime request" };
  }
}