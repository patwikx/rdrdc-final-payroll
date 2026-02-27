"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface SessionMonitorProps {
  checkInterval?: number; // in milliseconds, default 30 seconds
}

export function SessionMonitor({ checkInterval = 30000 }: SessionMonitorProps) {
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      // Skip if already logging out
      if (isLoggingOutRef.current) {
        return;
      }

      try {
        const response = await fetch("/api/auth/validate-session", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          // Mark as logging out to prevent multiple logout attempts
          isLoggingOutRef.current = true;

          // Start graceful transition
          setIsTransitioning(true);

          // Clear the interval to stop further checks
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Show loading animation for 5 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Perform logout without redirect
          await signOut({ redirect: false });

          // Small delay before navigation to ensure signOut completes
          await new Promise(resolve => setTimeout(resolve, 100));

          // Navigate to sign-in page
          router.push("/auth/sign-in?error=SessionExpired");
        }
      } catch (error) {
        console.error("Session check failed:", error);
        // Don't logout on network errors, only on invalid sessions
      }
    };

    // Initial check after a short delay to avoid checking during page load
    const initialTimeout = setTimeout(() => {
      checkSession();
    }, 2000);

    // Set up periodic checks
    intervalRef.current = setInterval(checkSession, checkInterval);

    // Cleanup on unmount
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval, router]);

  // Render a subtle overlay during transition to prevent flickering
  if (isTransitioning) {
    return (
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300"
        style={{ opacity: 1 }}
      >
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Session expired. Redirecting to sign-in page...</p>
        </div>
      </div>
    );
  }

  return null;
}
