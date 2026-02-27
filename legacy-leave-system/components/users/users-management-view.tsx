"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Users, 
  Shield,
  User,
  UserCheck,
  UserX,
  Building,
  Filter,
  Edit,
  MoreHorizontal
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UsersResponse, UserWithDetails } from "@/lib/actions/user-management-actions";


interface UsersManagementViewProps {
  usersData: UsersResponse;
  businessUnitId: string;
  currentFilters: {
    role?: string;
    department?: string;
    status?: string;
    search?: string;
    page: number;
  };
  isAdmin: boolean;
  pageType?: "admin" | "employees";
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'ADMIN':
      return Shield;
    case 'HR':
      return UserCheck;
    case 'MANAGER':
      return User;
    default:
      return User;
  }
}

function formatRole(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Admin';
    case 'HR':
      return 'HR';
    case 'MANAGER':
      return 'Manager';
    case 'USER':
      return 'User';
    case 'EMPLOYEE': // Keep for backward compatibility
      return 'Employee';
    default:
      return role;
  }
}

function getRoleVariant(role: string) {
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

// Note: Status functionality disabled until isActive field is confirmed
// function getStatusVariant(isActive: boolean) {
//   return isActive ? 'default' : 'secondary';
// }

const statusOptions = [
  { value: 'active', label: 'Active', icon: UserCheck },
  { value: 'inactive', label: 'Inactive', icon: UserX }
];

const roleOptions = [
  { value: 'ADMIN', label: 'Admin', icon: Shield },
  { value: 'HR', label: 'HR', icon: UserCheck },
  { value: 'MANAGER', label: 'Manager', icon: User },
  { value: 'USER', label: 'User', icon: User }
];



export function UsersManagementView({ 
  usersData, 
  businessUnitId,
  currentFilters,
  isAdmin,
  pageType = "admin"
}: UsersManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const users = usersData.users;
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "");

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== `all-${key}`) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    const basePath = pageType === "employees" ? "employees" : "admin/users";
    router.push(`/${businessUnitId}/${basePath}?${params.toString()}`);
  };

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    } else {
      params.delete('search');
    }
    
    // Reset to first page when searching
    params.delete('page');
    
    const basePath = pageType === "employees" ? "employees" : "admin/users";
    router.push(`/${businessUnitId}/${basePath}?${params.toString()}`);
  };

  const filteredUsers = useMemo(() => {
    // Server-side filtering is already applied, this is just for display
    return users;
  }, [users]);

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    const basePath = pageType === "employees" ? "employees" : "admin/users";
    router.push(`/${businessUnitId}/${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {pageType === "employees" ? "Employee Management" : "User Management"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pageType === "employees" ? "Manage employees, roles, and permissions" : "Manage users, roles, and permissions"}
          </p>
        </div>
        <Button onClick={() => router.push(`/${businessUnitId}/admin/users/create`)}>
          <Users className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name, email, or employee ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        
        <Button onClick={handleSearch} variant="outline">
          Search
        </Button>
        
        {/* Role Filter */}
        <Select
          value={currentFilters.role || ""}
          onValueChange={(value) => updateFilter('role', value || undefined)}
        >
          <SelectTrigger className="w-[150px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All roles" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-roles">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>All roles</span>
              </div>
            </SelectItem>
            {roleOptions.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={currentFilters.status || ""}
          onValueChange={(value) => updateFilter('status', value || undefined)}
        >
          <SelectTrigger className="w-[130px]">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span>All status</span>
              </div>
            </SelectItem>
            {statusOptions.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Department Filter */}
        <Select
          value={currentFilters.department || ""}
          onValueChange={(value) => updateFilter('department', value || undefined)}
        >
          <SelectTrigger className="w-[150px]">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All depts" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-departments">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>All departments</span>
              </div>
            </SelectItem>
            {usersData.departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{dept.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {usersData.pagination.totalCount} users
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const RoleIcon = getRoleIcon(user.role);
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.employeeId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(user.role)}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {formatRole(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.department ? user.department.name : "—"}
                    </TableCell>
                    <TableCell>
                      {user.approver ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{user.approver.name}</div>
                          <div className="text-xs text-muted-foreground">{user.approver.employeeId}</div>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.directReportsCount > 0 ? user.directReportsCount : "—"}
                    </TableCell>
                    <TableCell>{format(user.createdAt, "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                              <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/${businessUnitId}/${pageType === "employees" ? "employees" : "admin/users"}/${user.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              {pageType === "employees" ? "Edit Employee" : "Edit User"}
                            </Link>
                          </DropdownMenuItem>
                          {/* Note: Activate/Deactivate disabled until isActive field is confirmed */}
                          {/* <DropdownMenuItem>
                            <UserX className="h-4 w-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => {
            const RoleIcon = getRoleIcon(user.role);
            
            return (
              <Card key={user.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{user.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.employeeId}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge variant={getRoleVariant(user.role)}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {formatRole(user.role)}
                      </Badge>
                      <Badge variant="default">
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Department:</span>
                      <p className="font-medium">{user.department?.name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reports:</span>
                      <p className="font-medium">{user.directReportsCount || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Manager:</span>
                      <p className="font-medium">
                        {user.approver ? `${user.approver.name} (${user.approver.employeeId})` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Joined:</span>
                      <p className="font-medium">{format(user.createdAt, "MMM dd, yyyy")}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/${businessUnitId}/${pageType === "employees" ? "employees" : "admin/users"}/${user.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </Button>
                    {/* Note: Activate/Deactivate disabled until isActive field is confirmed */}
                    {/* <Button variant="outline" size="sm" className="flex-1">
                      <UserX className="h-4 w-4 mr-2" />
                      Deactivate
                    </Button> */}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {usersData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((usersData.pagination.currentPage - 1) * 10) + 1} to{' '}
            {Math.min(usersData.pagination.currentPage * 10, usersData.pagination.totalCount)} of{' '}
            {usersData.pagination.totalCount} users
          </div>
          
          <div className="flex gap-2">
            {usersData.pagination.hasPrev && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(usersData.pagination.currentPage - 1)}
              >
                Previous
              </Button>
            )}
            
            {usersData.pagination.hasNext && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(usersData.pagination.currentPage + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}