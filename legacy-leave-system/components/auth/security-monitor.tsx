"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

interface SecurityMonitorProps {
  userBusinessUnitId: string;
  userRole: string;
  isAcctg?: boolean;
  isPurchaser?: boolean;
}

export function SecurityMonitor({ userBusinessUnitId, userRole, isAcctg, isPurchaser }: SecurityMonitorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoggingOutRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Skip if already logging out
    if (isLoggingOutRef.current) {
      return;
    }

    // Extract business unit ID from pathname
    const pathSegments = pathname.split('/');
    const currentBusinessUnitId = pathSegments[1];

    // Security checks
    const performSecurityCheck = async () => {
      let shouldLogout = false;
      let reason = "";

      // Check if business unit ID is missing from URL
      if (!currentBusinessUnitId) {
        shouldLogout = true;
        reason = "Invalid URL structure detected";
      }
      // Check if business unit ID format is invalid
      else if (currentBusinessUnitId.length < 10 || !currentBusinessUnitId.startsWith('cm')) {
        shouldLogout = true;
        reason = "Invalid business unit format detected";
      }
      // Check if user is accessing unauthorized business unit
      // ADMIN, HR, Accounting, and Purchasing users can access different business units
      else if (
        userRole !== "ADMIN" && 
        userRole !== "HR" && 
        !isAcctg && 
        !isPurchaser && 
        currentBusinessUnitId !== userBusinessUnitId
      ) {
        // Redirect to unauthorized page instead of logging out
        toast.error("You don't have access to this business unit");
        router.push(`/${userBusinessUnitId}/unauthorized`);
        return;
      }

      if (shouldLogout) {
        try {
          // Mark as logging out
          isLoggingOutRef.current = true;

          // Show transition overlay
          setIsTransitioning(true);

          // Show toast
          toast.error(reason + ". Logging out for security.");

          // Show loading animation for 5 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Perform logout
          await signOut({ 
            callbackUrl: "/auth/sign-in?error=SecurityViolation&logout=true",
            redirect: true 
          });
        } catch (error) {
          console.error("Security logout error:", error);
          router.push("/auth/sign-in?error=SecurityViolation&logout=true");
        }
      }
    };

    performSecurityCheck();
  }, [pathname, userBusinessUnitId, userRole, isAcctg, isPurchaser, router]);

  // Render a subtle overlay during transition to prevent flickering
  if (isTransitioning) {
    return (
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300"
        style={{ opacity: 1 }}
      >
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-destructive mx-auto"></div>
          <p className="text-sm text-muted-foreground">Security violation detected. Logging out...</p>
        </div>
      </div>
    );
  }

  return null;
}