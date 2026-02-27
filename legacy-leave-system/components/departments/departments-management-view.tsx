"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building, 
  Users, 
  UserCheck, 
  Edit,
  Trash2,
  Crown
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
import Link from "next/link";
import { toast } from "sonner";
import { deleteDepartment } from "@/lib/actions/department-actions";
import { CreateDepartmentDialog } from "@/components/departments/create-department-dialog";
import { useRouter } from "next/navigation";

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

interface DepartmentsManagementViewProps {
  departments: DepartmentWithDetails[];
  businessUnitId: string;
  isAdmin: boolean;
}

export function DepartmentsManagementView({ 
  departments, 
  businessUnitId,
  isAdmin 
}: DepartmentsManagementViewProps) {
  const router = useRouter();

  const handleDeleteDepartment = async (departmentId: string, departmentName: string) => {
    try {
      const result = await deleteDepartment(departmentId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Department ${departmentName} deleted successfully`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to delete department");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Department Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage departments and assign managers
          </p>
        </div>
        <CreateDepartmentDialog businessUnitId={businessUnitId} />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {departments.length} department{departments.length !== 1 ? 's' : ''} found
      </div>

      {/* Departments Grid */}
      <div className="grid gap-6">
        {departments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Departments Yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first department to start organizing employees.
                </p>
                <CreateDepartmentDialog businessUnitId={businessUnitId} />
              </div>
            </CardContent>
          </Card>
        ) : (
          departments.map((department) => (
            <Card key={department.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      {department.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {department.members.length} member{department.members.length !== 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center gap-1">
                        <Crown className="h-4 w-4" />
                        {department.managers.length} manager{department.managers.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <Link href={`/${businessUnitId}/departments/${department.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={department.members.length > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Department</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{department.name}"? This action cannot be undone.
                            {department.members.length > 0 && (
                              <span className="block mt-2 text-destructive">
                                This department has {department.members.length} member(s) assigned and cannot be deleted.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteDepartment(department.id, department.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={department.members.length > 0}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Department Managers */}
                  {department.managers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Department Managers
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {department.managers.map((managerAssignment) => (
                          <Badge key={managerAssignment.id} variant="secondary" className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3" />
                            {managerAssignment.manager.name} ({managerAssignment.manager.employeeId})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Department Members */}
                  {department.members.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No employees assigned to this department yet.
                    </p>
                  ) : (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Department Members
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {department.members.slice(0, 6).map((member) => (
                          <div key={member.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                            <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{member.name}</p>
                              <p className="text-muted-foreground text-xs truncate">
                                {member.employeeId} • {member.role}
                              </p>
                            </div>
                          </div>
                        ))}
                        {department.members.length > 6 && (
                          <div className="flex items-center justify-center p-2 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                            +{department.members.length - 6} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}