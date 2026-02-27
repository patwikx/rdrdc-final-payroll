"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Plus,
  Edit,
  Trash2,
  Power,
  Calculator,
  Building,
  DollarSign,
  TrendingUp,
  TrendingDown,
  MoreHorizontal
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { GLAccountsResponse, GLAccount, toggleGLAccountStatus, deleteGLAccount } from "@/lib/actions/gl-account-actions"
import { AccountType, DebitCredit } from "@prisma/client"
import { CreateGLAccountDialog } from "./create-gl-account-dialog"
import { EditGLAccountDialog } from "./edit-gl-account-dialog"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface GLAccountsManagementViewProps {
  accountsData: GLAccountsResponse
  businessUnitId: string
  currentFilters: {
    accountType?: AccountType
    isActive?: boolean
    search?: string
    page: number
  }
}

// Helper functions
function getAccountTypeIcon(type: AccountType) {
  switch (type) {
    case "ASSET":
      return Building
    case "LIABILITY":
      return TrendingDown
    case "EQUITY":
      return DollarSign
    case "REVENUE":
      return TrendingUp
    case "EXPENSE":
      return Calculator
    default:
      return Calculator
  }
}

function getAccountTypeColor(type: AccountType): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "ASSET":
      return "default"
    case "LIABILITY":
      return "destructive"
    case "EQUITY":
      return "secondary"
    case "REVENUE":
      return "default"
    case "EXPENSE":
      return "outline"
    default:
      return "outline"
  }
}

function getNormalBalanceIcon(balance: DebitCredit) {
  return balance === "DEBIT" ? TrendingUp : TrendingDown
}

export function GLAccountsManagementView({ 
  accountsData, 
  businessUnitId,
  currentFilters 
}: GLAccountsManagementViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<GLAccount | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<GLAccount | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Use server-side filtered accounts directly
  const filteredAccounts = accountsData.accounts

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    // Reset to first page when filters change
    if (key !== 'page') {
      params.delete('page')
    }
    
    router.push(`/${businessUnitId}/admin/gl-accounts?${params.toString()}`)
  }

  const handleSearch = () => {
    updateFilter('search', searchTerm || undefined)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleToggleStatus = async (account: GLAccount) => {
    setIsLoading(true)
    try {
      const result = await toggleGLAccountStatus(account.id, !account.isActive)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update account status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingAccount) return

    setIsLoading(true)
    try {
      const result = await deleteGLAccount(deletingAccount.id)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to delete account")
    } finally {
      setIsLoading(false)
      setDeletingAccount(null)
    }
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">GL Accounts Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage chart of accounts for asset management
          </p>
        </div>
        
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by account code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10"
          />
          {searchTerm !== (currentFilters.search || "") && (
            <Button
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
              onClick={handleSearch}
            >
              Search
            </Button>
          )}
        </div>
        
        {/* Account Type Filter */}
        <Select
          value={currentFilters.accountType || ""}
          onValueChange={(value) => updateFilter('accountType', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All account types" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All account types</SelectItem>
            <SelectItem value="ASSET">Asset</SelectItem>
            <SelectItem value="LIABILITY">Liability</SelectItem>
            <SelectItem value="EQUITY">Equity</SelectItem>
            <SelectItem value="REVENUE">Revenue</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={currentFilters.isActive === undefined ? "" : currentFilters.isActive.toString()}
          onValueChange={(value) => updateFilter('isActive', value || undefined)}
        >
          <SelectTrigger className="w-[140px]">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All statuses" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>



      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAccounts.length} of {accountsData.totalCount} GL accounts
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal Balance</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Calculator className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No accounts match your search criteria" : "No GL accounts found"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => {
                const TypeIcon = getAccountTypeIcon(account.accountType)
                const BalanceIcon = getNormalBalanceIcon(account.normalBalance)
                
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <span className="font-mono font-medium">{account.accountCode}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{account.accountName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={getAccountTypeColor(account.accountType)}>
                          {account.accountType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BalanceIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{account.normalBalance}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {account.description || "No description"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
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
                          <DropdownMenuItem onClick={() => setEditingAccount(account)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleStatus(account)}
                            disabled={isLoading}
                          >
                            <Power className={`h-4 w-4 mr-2 ${account.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                            {account.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeletingAccount(account)}
                            disabled={isLoading}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-4 sm:hidden">
        {filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No GL accounts found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm ? "No accounts match your search criteria." : "No GL accounts have been set up yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAccounts.map((account) => {
            const TypeIcon = getAccountTypeIcon(account.accountType)
            const BalanceIcon = getNormalBalanceIcon(account.normalBalance)
            
            return (
              <Card key={account.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-mono">{account.accountCode}</CardTitle>
                      <p className="text-sm font-medium mt-1">{account.accountName}</p>
                    </div>
                    <Badge variant={account.isActive ? "default" : "secondary"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={getAccountTypeColor(account.accountType)}>
                          {account.accountType}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Normal Balance:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <BalanceIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{account.normalBalance}</span>
                      </div>
                    </div>
                  </div>
                  
                  {account.description && (
                    <div>
                      <span className="text-muted-foreground text-sm">Description:</span>
                      <p className="text-sm mt-1">{account.description}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditingAccount(account)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-3"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleToggleStatus(account)}
                          disabled={isLoading}
                        >
                          <Power className={`h-4 w-4 mr-2 ${account.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeletingAccount(account)}
                          disabled={isLoading}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {accountsData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentFilters.page - 1) * 20) + 1} to {Math.min(currentFilters.page * 20, accountsData.totalCount)} of {accountsData.totalCount} accounts
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('page', (currentFilters.page - 1).toString())}
              disabled={currentFilters.page <= 1}
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, accountsData.totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(
                  accountsData.totalPages - 4,
                  currentFilters.page - 2
                )) + i
                
                if (pageNum > accountsData.totalPages) return null
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentFilters.page ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => updateFilter('page', pageNum.toString())}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('page', (currentFilters.page + 1).toString())}
              disabled={currentFilters.page >= accountsData.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Account Dialog */}
      <CreateGLAccountDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Edit Account Dialog */}
      {editingAccount && (
        <EditGLAccountDialog
          account={editingAccount}
          open={!!editingAccount}
          onOpenChange={(open) => !open && setEditingAccount(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GL Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account "{deletingAccount?.accountCode} - {deletingAccount?.accountName}"? 
              This action cannot be undone and will fail if the account is being used by any assets or categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}