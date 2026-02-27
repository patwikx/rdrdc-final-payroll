"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ForceLogoutProps {
  reason?: string;
  shouldLogout: boolean;
}

export function ForceLogout({ reason = "Session invalid", shouldLogout }: ForceLogoutProps) {
  const router = useRouter();

  useEffect(() => {
    if (shouldLogout) {
      const performLogout = async () => {
        try {
          toast.error(reason);
          await signOut({ 
            callbackUrl: "/auth/sign-in?error=SessionInvalid",
            redirect: true 
          });
        } catch (error) {
          console.error("Force logout error:", error);
          // Fallback: redirect manually if signOut fails
          router.push("/auth/sign-in?error=SessionInvalid");
        }
      };

      performLogout();
    }
  }, [shouldLogout, reason, router]);

  // Don't render anything
  return null;
}