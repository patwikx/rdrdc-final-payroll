"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building, 
  Users, 
  UserCheck, 
  UserMinus,
  UserPlus,
  ArrowLeft,
  Crown
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  updateDepartment, 
  assignManagerToDepartment,
  removeManagerFromDepartment 
} from "@/lib/actions/department-actions";
import { DepartmentApproversCard } from "./department-approvers-card";

interface DepartmentWithDetails {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    id: string;
    name: string;
    employeeId: string;
    email: string | null;
    role: string;
  }[];
  managers: {
    id: string;
    departmentId: string;
    managerId: string;
    createdAt: Date;
    updatedAt: Date;
    manager: {
      id: string;
      name: string;
      employeeId: string;
      email: string | null;
      role: string;
    };
  }[];
}

interface AvailableManager {
  id: string;
  name: string;
  employeeId: string;
  email: string | null;
  role: string;
  businessUnit: {
    name: string;
  } | null;
}

interface EditDepartmentFormProps {
  department: DepartmentWithDetails;
  availableManagers: AvailableManager[];
  businessUnitId: string;
  isAdmin: boolean;
}

export function EditDepartmentForm({ 
  department, 
  availableManagers, 
  businessUnitId,
  isAdmin 
}: EditDepartmentFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [assignManagerDialogOpen, setAssignManagerDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState("");
  const [formData, setFormData] = useState({
    name: department.name,
  });

  // Filter out managers who are already assigned to this department
  const assignedManagerIds = department.managers.map(m => m.managerId);
  const unassignedManagers = availableManagers.filter(m => !assignedManagerIds.includes(m.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Please enter a department name");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await updateDepartment(department.id, {
        name: formData.name.trim(),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Department updated successfully");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update department");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignManager = async () => {
    if (!selectedManager) {
      toast.error("Please select a manager");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await assignManagerToDepartment(department.id, selectedManager);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Manager assigned successfully");
        setAssignManagerDialogOpen(false);
        setSelectedManager("");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to assign manager");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveManager = async (managerId: string, managerName: string) => {
    setIsLoading(true);
    
    try {
      const result = await removeManagerFromDepartment(department.id, managerId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${managerName} removed from department management successfully`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to remove manager");
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
        {/* Left Column - Department Info & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Department Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{department.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {department.members.length} members • {department.managers.length} managers
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {department.members.length} Members
                  </Badge>
                  <Badge variant="outline">
                    {department.managers.length} Managers
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit Department Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Department Name <span className="text-red-500">*</span>
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

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/${businessUnitId}/departments`)}
                    disabled={isLoading}
                    className="h-9"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading} className="h-9">
                    {isLoading ? "Updating..." : "Update Department"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Stats & Management */}
        <div className="space-y-6">

          {/* Department Approvers */}
          <DepartmentApproversCard 
            departmentId={department.id}
            departmentName={department.name}
            businessUnitId={businessUnitId}
          />

          {/* Department Managers */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Department Managers
                </CardTitle>
                {unassignedManagers.length > 0 && (
                  <Dialog open={assignManagerDialogOpen} onOpenChange={setAssignManagerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Manager to Department</DialogTitle>
                        <DialogDescription>
                          Select a manager to assign to the {department.name} department.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="manager">Select Manager</Label>
                          <Select value={selectedManager} onValueChange={setSelectedManager}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a manager..." />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedManagers.map((manager) => (
                                <SelectItem key={manager.id} value={manager.id}>
                                  {manager.name} ({manager.employeeId}) - {manager.role}
                                  {manager.businessUnit && (
                                    <span className="text-muted-foreground ml-2">
                                      • {manager.businessUnit.name}
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAssignManagerDialogOpen(false);
                            setSelectedManager("");
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAssignManager}
                          disabled={isLoading || !selectedManager}
                          className="flex-1"
                        >
                          {isLoading ? "Assigning..." : "Assign Manager"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {department.managers.length === 0 ? (
                <div className="text-center py-6">
                  <Crown className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No managers assigned yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {department.managers.map((managerAssignment) => (
                    <div key={managerAssignment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{managerAssignment.manager.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {managerAssignment.manager.employeeId} • {managerAssignment.manager.role}
                          </p>
                          {managerAssignment.manager.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {managerAssignment.manager.email}
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
                            <AlertDialogTitle>Remove Manager from Department</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{managerAssignment.manager.name}" from managing the "{department.name}" department?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRemoveManager(managerAssignment.managerId, managerAssignment.manager.name)}
                            >
                              Remove Manager
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

          {/* Department Members Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Department Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              {department.members.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No members assigned yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Members are assigned through the employee management page
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {department.members.slice(0, 5).map((member) => (
                    <div key={member.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                      <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{member.name}</p>
                        <p className="text-muted-foreground text-xs truncate">
                          {member.employeeId} • {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                  {department.members.length > 5 && (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      +{department.members.length - 5} more members
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

                    {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Members:</span>
                <span className="font-medium">{department.members.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Managers:</span>
                <span className="font-medium">{department.managers.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium text-right">
                  {new Date(department.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="font-medium text-right">
                  {new Date(department.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}