import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getGLAccounts } from "@/lib/actions/gl-account-actions"
import { GLAccountsManagementView } from "@/components/admin/gl-accounts-management-view"
import { AccountType } from "@prisma/client"

interface AdminGLAccountsPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    accountType?: AccountType
    isActive?: string
    search?: string
    page?: string
  }>
}

export default async function AdminGLAccountsPage({ params, searchParams }: AdminGLAccountsPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has admin permissions
  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized")
  }

  const { businessUnitId } = await params
  const { accountType, isActive, search, page = "1" } = await searchParams
  
  try {
    const accountsData = await getGLAccounts({
      accountType,
      isActive: isActive ? isActive === 'true' : undefined,
      search,
      page: parseInt(page),
      limit: 20
    })
    
    return (
      <div className="space-y-6">
        <GLAccountsManagementView 
          accountsData={accountsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            accountType,
            isActive: isActive ? isActive === 'true' : undefined,
            search,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading GL accounts:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GL Accounts Management</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load GL accounts. Please try again later.</p>
        </div>
      </div>
    )
  }
}