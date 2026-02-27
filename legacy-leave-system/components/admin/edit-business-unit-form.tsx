"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  UserMinus, 
  ArrowLeft,
  AlertCircle 
} from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  updateBusinessUnit, 
  removeUserFromBusinessUnit 
} from "@/lib/actions/business-unit-actions";

interface BusinessUnitWithEmployees {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
  employees: {
    id: string;
    name: string;
    employeeId: string;
    email: string | null;
    role: string;
  }[];
}

interface EditBusinessUnitFormProps {
  businessUnit: BusinessUnitWithEmployees;
  businessUnitId: string;
}

export function EditBusinessUnitForm({ businessUnit, businessUnitId }: EditBusinessUnitFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: businessUnit.name,
    code: businessUnit.code,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await updateBusinessUnit(businessUnit.id, {
        name: formData.name.trim(),
        code: formData.code.trim(),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Business unit updated successfully");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update business unit");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    setIsLoading(true);
    
    try {
      const result = await removeUserFromBusinessUnit(userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${userName} removed from business unit successfully`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to remove user from business unit");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Business Unit Info & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Unit Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{businessUnit.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Code: {businessUnit.code} • {businessUnit.employees.length} employees
                  </p>
                </div>
                <Badge variant="secondary">
                  {businessUnit.employees.length} Users
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit Business Unit Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Business Unit Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="h-9"
                      placeholder="e.g., Human Resources"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm font-medium">
                      Business Unit Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => handleInputChange("code", e.target.value)}
                      className="h-9"
                      placeholder="e.g., HR"
                      required
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/${businessUnitId}/admin/business-units`)}
                    disabled={isLoading}
                    className="h-9"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading} className="h-9">
                    {isLoading ? "Updating..." : "Update Business Unit"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Stats & Employees */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Employees:</span>
                <span className="font-medium">{businessUnit.employees.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium text-right">
                  {new Date(businessUnit.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="font-medium text-right">
                  {new Date(businessUnit.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Employees List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assigned Employees</CardTitle>
            </CardHeader>
            <CardContent>
              {businessUnit.employees.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No employees assigned yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {businessUnit.employees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{employee.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {employee.employeeId} • {employee.role}
                          </p>
                          {employee.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {employee.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={isLoading}
                            className="flex-shrink-0"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove User from Business Unit</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{employee.name}" from "{businessUnit.name}"? 
                              They will need to be reassigned to access the system.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRemoveUser(employee.id, employee.name)}
                            >
                              Remove User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}