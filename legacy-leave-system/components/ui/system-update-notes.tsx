import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info, CheckCircle, AlertCircle, Zap } from "lucide-react"

const systemUpdates = [
  {
    version: "2.2.0",
    date: "2024-11-06",
    type: "major" as const,
    title: "Asset Management & MRS Online System Integration",
    changes: [
      "✅ NEW: Complete Depreciation Reports system with Schedule, Net Book Value, and Damaged & Loss reports",
      "✅ NEW: Professional print-ready report formats matching accounting standards",
      "🏢 ENHANCED: MRS Coordinator workflow with proper acknowledgement management",
      "✅ NEW: Cpreate Acknowledgements page for e-signature management",
      "✅ NEW: Done Requests page for completed material requests tracking",
      "🔄 IMPROVED: Material Request workflow separation and status management",
      "✅ NEW: MRS database functions - getApprovedRequestsForAcknowledgement() and getDoneRequests()",
      "🔍 ENHANCED: Smart filtering logic for request status and e-signature management",
      "🎨 IMPROVED: Removed card containers from detail pages for cleaner UI",
      "🧭 ENHANCED: Dynamic breadcrumbs with all new report and coordinator routes",
      "📱 IMPROVED: Mobile-responsive design across all new pages",
      "🔧 FIXED: TypeScript issues and proper data type handling for reports",
      "🗄️ UPDATED: MaterialRequest type definition with supplier and processing fields"
    ]
  },
  {
    version: "2.1.1",
    date: "2024-11-04",
    type: "patch" as const,
    title: "Critical Security Patch",
    changes: [
      "🔒 CRITICAL: Fixed password storage vulnerability - all passwords now properly hashed with bcryptjs",
      "🔒 Enhanced password security in user creation and password reset functions",
      "🔒 Implemented consistent 8-character minimum password requirement",
      "🔒 Added proper salt rounds (12) for maximum security",
      "✅ Verified all user management functions use secure password hashing"
    ]
  },
  {
    version: "2.1.0",
    date: "2024-11-03",
    type: "major" as const,
    title: "Enhanced Security & Performance",
    changes: [
      "Fixed Suspense boundary issues for better performance",
      "Improved authentication flow and security monitoring",
      "Enhanced error handling and user feedback",
      "Optimized database queries for faster load times",
      "Added comprehensive logging for better debugging"
    ]
  },
  {
    version: "2.0.5",
    date: "2024-10-28",
    type: "minor" as const,
    title: "UI/UX Improvements",
    changes: [
      "Updated dashboard layout for better responsiveness",
      "Improved form validation and error messages",
      "Enhanced mobile experience across all pages",
      "Added dark mode support improvements"
    ]
  },
  {
    version: "2.0.0",
    date: "2024-10-15",
    type: "major" as const,
    title: "Major System Overhaul",
    changes: [
      "Complete redesign with modern UI components",
      "Migrated to Next.js 14 App Router",
      "Implemented role-based access control",
      "Added comprehensive leave management features",
      "Integrated overtime request system"
    ]
  }
]

const getUpdateIcon = (type: string) => {
  switch (type) {
    case "major":
      return <Zap className="h-4 w-4 text-orange-500" />
    case "minor":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "patch":
      return <AlertCircle className="h-4 w-4 text-blue-500" />
    default:
      return <Info className="h-4 w-4 text-gray-500" />
  }
}

const getUpdateBadgeVariant = (type: string) => {
  switch (type) {
    case "major":
      return "destructive" as const
    case "minor":
      return "default" as const
    case "patch":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function SystemUpdateNotes() {
  const currentVersion = systemUpdates[0]

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
                <Badge variant="outline" className="text-xs font-mono">
                  v{currentVersion.version}
                </Badge>
                <Info className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>System Version & Update Notes</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none flex items-center gap-2">
                <Info className="h-4 w-4" />
                System Updates
              </h4>
              <p className="text-sm text-muted-foreground">
                Recent changes and improvements to the system
              </p>
            </div>
            
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {systemUpdates.map((update, index) => (
                <div key={update.version} className="space-y-2 pb-3 border-b last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getUpdateIcon(update.type)}
                      <span className="font-medium text-sm">v{update.version}</span>
                      <Badge variant={getUpdateBadgeVariant(update.type)} className="text-xs">
                        {update.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{update.date}</span>
                  </div>
                  
                  <h5 className="text-sm font-medium">{update.title}</h5>
                  
                  <ul className="space-y-1">
                    {update.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Current version: <span className="font-mono font-medium">v{currentVersion.version}</span> • Last updated: {currentVersion.date}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  )
}