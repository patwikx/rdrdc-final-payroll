"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  UserPlus, 
  UserMinus, 
  Trash2,
  AlertCircle,
  Edit
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { 
  assignUserToBusinessUnit, 
  removeUserFromBusinessUnit,
  deleteBusinessUnit 
} from "@/lib/actions/business-unit-actions";
import { CreateBusinessUnitDialog } from "@/components/admin/create-business-unit-dialog";
import Link from "next/link";

interface BusinessUnit {
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

interface UnassignedUser {
  id: string;
  name: string;
  employeeId: string;
  email: string | null;
  role: string;
  classification: string | null;
}

interface BusinessUnitManagementProps {
  businessUnits: BusinessUnit[];
  unassignedUsers: UnassignedUser[];
  businessUnitId: string;
}

export function BusinessUnitManagement({ 
  businessUnits, 
  unassignedUsers,
  businessUnitId 
}: BusinessUnitManagementProps) {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");

  const handleAssignUser = async (formData: FormData) => {
    const result = await assignUserToBusinessUnit(formData);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
      setIsAssignDialogOpen(false);
      setSelectedBusinessUnit("");
      setSelectedUser("");
    }
  };

  const handleRemoveUser = async (userId: string) => {
    const result = await removeUserFromBusinessUnit(userId);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
    }
  };

  const handleDeleteBusinessUnit = async (businessUnitId: string) => {
    const result = await deleteBusinessUnit(businessUnitId);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <CreateBusinessUnitDialog />

        {unassignedUsers.length > 0 && (
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Users ({unassignedUsers.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign User to Business Unit</DialogTitle>
                <DialogDescription>
                  Select a user and business unit to create the assignment.
                </DialogDescription>
              </DialogHeader>
              <form action={handleAssignUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">Select User</Label>
                  <Select name="userId" value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.employeeId}) - {user.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessUnitId">Select Business Unit</Label>
                  <Select name="businessUnitId" value={selectedBusinessUnit} onValueChange={setSelectedBusinessUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a business unit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {businessUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAssignDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!selectedUser || !selectedBusinessUnit}
                  >
                    Assign User
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Unassigned Users Alert */}
      {unassignedUsers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  {unassignedUsers.length} User(s) Need Business Unit Assignment
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  These users cannot access the system until they are assigned to a business unit.
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassignedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="text-xs">
                      {user.name} ({user.employeeId})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Units List */}
      <div className="grid gap-6">
        {businessUnits.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Business Units Yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first business unit to start organizing employees.
                </p>
                <CreateBusinessUnitDialog />
              </div>
            </CardContent>
          </Card>
        ) : (
          businessUnits.map((unit) => (
            <Card key={unit.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {unit.name}
                      <Badge variant="secondary">{unit.code}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {unit.employees.length} employee(s) assigned
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <Link href={`/${businessUnitId}/admin/business-units/${unit.id}`}>
                        <Edit className="w-4 h-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={unit.employees.length > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Business Unit</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{unit.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteBusinessUnit(unit.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                {unit.employees.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No employees assigned to this business unit yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {unit.employees.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {employee.employeeId} • {employee.role}
                              {employee.email && ` • ${employee.email}`}
                            </p>
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove User from Business Unit</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{employee.name}" from "{unit.name}"? 
                                They will need to be reassigned to access the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleRemoveUser(employee.id)}
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
          ))
        )}
      </div>
    </div>
  );
}