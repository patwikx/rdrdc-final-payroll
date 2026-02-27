"use client";

import { useEffect } from "react";
import { useBusinessUnitModal } from "@/hooks/use-bu-modal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, AlertCircle } from "lucide-react";

interface SetupPageClientProps {
  user: {
    id: string;
    name: string;
    employeeId: string;
    role: string;
  };
}

export function SetupPageClient({ user }: SetupPageClientProps) {
  const onOpen = useBusinessUnitModal((state) => state.onOpen);
  const isOpen = useBusinessUnitModal((state) => state.isOpen);

  useEffect(() => {
    if (!isOpen) {
      onOpen();
    }
  }, [isOpen, onOpen]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Setup Required</h1>
          <p className="text-muted-foreground">
            Hello {user.name}, you need to be assigned to a business unit to continue.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                Business Unit Assignment Needed
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Please contact your administrator to assign you to a business unit, or select one if you have permission.
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => onOpen()} 
            className="w-full"
            variant="default"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Select Business Unit
          </Button>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Employee ID: {user.employeeId} • Role: {user.role}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Need help? Contact your system administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}