import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldX, ArrowLeft, Lock } from "lucide-react"
import Link from "next/link"

interface UnauthorizedPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function UnauthorizedPage({ params }: UnauthorizedPageProps) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/sign-in")
  }

  const { businessUnitId } = await params

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-6">
          {/* Animated Icons */}
          <div className="flex justify-center items-center gap-6">
            <Lock 
              className="h-16 w-16 text-destructive/70 stroke-[1.5]" 
              style={{ 
                animation: 'bounce 2s ease-in-out infinite',
                animationDelay: '0s'
              }} 
            />
            <ShieldX 
              className="h-24 w-24 text-destructive stroke-[1.5]" 
              style={{ 
                animation: 'bounce 2s ease-in-out infinite',
                animationDelay: '0.3s'
              }} 
            />
            <Lock 
              className="h-16 w-16 text-destructive/70 stroke-[1.5]" 
              style={{ 
                animation: 'bounce 2s ease-in-out infinite',
                animationDelay: '0.6s'
              }} 
            />
          </div>
          
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Access Denied</h1>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              You don't have permission to access this business unit or resource. 
              If you believe this is an error, please contact your administrator or the MIS Department.
            </p>
          </div>
          
          {/* Info Box */}
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <ShieldX className="h-5 w-5 text-destructive" />
            <span className="text-sm text-foreground font-medium">Insufficient Permissions</span>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button 
            asChild 
            variant="default"
            className="w-full sm:w-auto px-6 py-5 text-base"
          >
            <Link href={`/${businessUnitId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          
          <Button 
            asChild 
            variant="outline"
            className="w-full sm:w-auto px-6 py-5 text-base"
          >
            <Link href="mailto:mis@rdrealty.com.ph">
              Contact MIS Department
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}