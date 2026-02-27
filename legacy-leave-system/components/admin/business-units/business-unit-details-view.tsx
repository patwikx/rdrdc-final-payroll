"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Building2, 
  Users, 
  ArrowLeft, 
  Edit, 
  Save, 
  X,
  Calendar,
  Hash} from "lucide-react";
import { toast } from "sonner";
import { BusinessUnitLogoUpload } from "./business-unit-logo-upload";

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  employees: {
    id: string;
    name: string;
    employeeId: string;
    email: string | null;
    role: string;
    classification: string | null;
    createdAt: Date;
    department: {
      id: string;
      name: string;
    } | null;
  }[];
  _count: {
    employees: number;
  };
}

interface BusinessUnitDetailsViewProps {
  businessUnit: BusinessUnit;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  businessUnitId: string;
}

// Helper function to get business unit initials
function getBusinessUnitInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Helper function to format role display
function formatRole(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'HR':
      return 'Human Resources';
    case 'MANAGER':
      return 'Manager';
    case 'USER':
      return 'Employee';
    default:
      return role;
  }
}

// Helper function to get role color
function getRoleColor(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'ADMIN':
      return 'destructive';
    case 'HR':
      return 'default';
    case 'MANAGER':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function BusinessUnitDetailsView({ businessUnit, currentUser, businessUnitId }: BusinessUnitDetailsViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(businessUnit.image);
  const [formData, setFormData] = useState({
    name: businessUnit.name,
    code: businessUnit.code,
  });

  const initials = getBusinessUnitInitials(businessUnit.name);

  // Load existing logo on mount
  useEffect(() => {
    const loadLogo = async () => {
      if (businessUnit.image) {
        try {
          const response = await fetch(`/api/business-unit-logo/${encodeURIComponent(businessUnit.image)}`);
          const result = await response.json();
          
          if (result.success && result.fileUrl) {
            setLogoUrl(result.fileUrl);
          }
        } catch (error) {
          console.error('Error loading business unit logo:', error);
        }
      }
    };

    loadLogo();
  }, [businessUnit.image]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Here you would implement the API call to update business unit
      // const result = await updateBusinessUnit(businessUnit.id, formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success("Business unit updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update business unit");
      console.error("Business unit update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: businessUnit.name,
      code: businessUnit.code,
    });
    setIsEditing(false);
  };

  const handleLogoUpload = (imageUrl: string, fileName: string) => {
    setLogoUrl(imageUrl);
    setLogoFileName(fileName);
  };

  const handleLogoRemove = () => {
    setLogoUrl(null);
    setLogoFileName(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Business Unit Details</h1>
            <p className="text-sm text-muted-foreground">
              Manage business unit information and employees
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Business Unit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleSave} 
                disabled={isLoading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isLoading ? "Saving..." : "Save"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isLoading}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Business Unit Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            {/* Logo Upload Section */}
            <BusinessUnitLogoUpload
              currentImageUrl={logoUrl}
              businessUnitInitials={initials}
              businessUnitName={businessUnit.name}
              businessUnitId={businessUnit.id}
              onUploadSuccess={handleLogoUpload}
              onRemoveSuccess={handleLogoRemove}
            />
            
            <div className="space-y-2">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="text-center text-xl font-semibold"
                  />
                </div>
              ) : (
                <CardTitle className="text-xl">{businessUnit.name}</CardTitle>
              )}
              
              <CardDescription className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {isEditing ? (
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                      className="text-center w-24"
                    />
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Hash className="h-3 w-3" />
                      {businessUnit.code}
                    </Badge>
                  )}
                </div>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{businessUnit._count.employees} employees</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Created {new Date(businessUnit.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Updated {new Date(businessUnit.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employees List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees ({businessUnit._count.employees})
            </CardTitle>
            <CardDescription>
              All employees assigned to this business unit
            </CardDescription>
          </CardHeader>
          <CardContent>
            {businessUnit.employees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No employees found</h3>
                <p className="text-muted-foreground">
                  No employees are currently assigned to this business unit.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessUnit.employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {employee.employeeId}
                                {employee.email && ` • ${employee.email}`}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleColor(employee.role)}>
                            {formatRole(employee.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {employee.department ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{employee.department.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No department</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(employee.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}