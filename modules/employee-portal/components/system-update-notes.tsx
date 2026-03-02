import { IconAlertCircle, IconBolt, IconCheck, IconInfoCircle } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type SystemUpdateEntry = {
  version: string
  date: string
  type: "major" | "minor" | "patch"
  title: string
  changes: string[]
}

export const SYSTEM_UPDATE_ENTRIES: SystemUpdateEntry[] = [
  {
    version: "2.3.1",
    date: "2026-01-18",
    type: "patch",
    title: "Next.js CVE Security Patch (January 2026)",
    changes: [
      "Applied upstream Next.js security fixes for newly disclosed CVEs.",
      "Revalidated middleware and routing behavior after patch-level upgrade.",
      "Rebuilt and verified production build output after dependency update.",
    ],
  },
  {
    version: "2.3.1",
    date: "2025-12-19",
    type: "patch",
    title: "Next.js CVE Security Patch (December 2025)",
    changes: [
      "Patched framework-level Next.js vulnerability advisories released in December.",
      "Hardened request handling path aligned with patched framework behavior.",
      "Completed post-patch regression checks for portal and dashboard routes.",
    ],
  },
  {
    version: "2.2.0",
    date: "2024-11-06",
    type: "major",
    title: "Asset Management & MRS Online System Integration",
    changes: [
      "Complete Depreciation Reports system with Schedule, Net Book Value, and Damaged & Loss reports.",
      "Added print-ready report formats matching accounting standards.",
      "Improved MRS coordinator workflow with acknowledgment management.",
      "Added acknowledgments page for e-signature management.",
      "Added Done Requests page for completed material requests tracking.",
      "Improved Material Request workflow separation and status management.",
      "Added MRS database functions for approved and completed request retrieval.",
      "Enhanced filtering logic for request status and e-signature management.",
      "Removed card containers from detail pages for cleaner UI.",
      "Added dynamic breadcrumbs for new report and coordinator routes.",
      "Improved mobile responsiveness across new pages.",
      "Fixed TypeScript typing issues in reports.",
      "Updated MaterialRequest type definition with supplier and processing fields.",
    ],
  },
  {
    version: "2.1.1",
    date: "2024-11-04",
    type: "patch",
    title: "Critical Security Patch",
    changes: [
      "Fixed password storage vulnerability by applying bcryptjs hashing consistently.",
      "Enhanced password security in user creation and reset flows.",
      "Enforced consistent 8-character minimum password requirement.",
      "Applied 12 salt rounds for password hashing.",
      "Verified secure password hashing across user management paths.",
    ],
  },
  {
    version: "2.1.0",
    date: "2024-11-03",
    type: "major",
    title: "Enhanced Security & Performance",
    changes: [
      "Fixed Suspense boundary issues for improved performance.",
      "Improved authentication flow and security monitoring.",
      "Enhanced error handling and user feedback.",
      "Optimized database queries for faster load times.",
      "Added comprehensive logging for improved debugging.",
    ],
  },
  {
    version: "2.0.5",
    date: "2024-10-28",
    type: "minor",
    title: "UI/UX Improvements",
    changes: [
      "Updated dashboard layout for better responsiveness.",
      "Improved form validation and error messages.",
      "Enhanced mobile experience across pages.",
      "Improved dark mode support.",
    ],
  },
  {
    version: "2.0.0",
    date: "2024-10-15",
    type: "major",
    title: "Major System Overhaul",
    changes: [
      "Complete redesign with modern UI components.",
      "Migrated to Next.js 14 App Router.",
      "Implemented role-based access control.",
      "Added comprehensive leave management features.",
      "Integrated overtime request system.",
    ],
  },
]

const getUpdateIcon = (type: SystemUpdateEntry["type"]) => {
  if (type === "major") {
    return <IconBolt className="h-4 w-4 text-orange-500" />
  }

  if (type === "minor") {
    return <IconCheck className="h-4 w-4 text-green-500" />
  }

  if (type === "patch") {
    return <IconAlertCircle className="h-4 w-4 text-blue-500" />
  }

  return <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
}

const getUpdateBadgeVariant = (
  type: SystemUpdateEntry["type"]
): "destructive" | "default" | "secondary" | "outline" => {
  if (type === "major") {
    return "destructive"
  }

  if (type === "minor") {
    return "default"
  }

  if (type === "patch") {
    return "secondary"
  }

  return "outline"
}

export function SystemUpdateNotes() {
  const currentVersion = SYSTEM_UPDATE_ENTRIES[0]

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                <Badge variant="outline" className="text-xs font-mono">
                  v{currentVersion.version}
                </Badge>
                <IconInfoCircle className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>System Version &amp; Update Notes</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 font-medium leading-none">
                <IconInfoCircle className="h-4 w-4" />
                System Updates
              </h4>
              <p className="text-sm text-muted-foreground">Recent changes and improvements to the system.</p>
            </div>

            <div className="max-h-80 space-y-4 overflow-y-auto">
              {SYSTEM_UPDATE_ENTRIES.map((update) => (
                <div key={`${update.version}-${update.date}`} className="space-y-2 border-b pb-3 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getUpdateIcon(update.type)}
                      <span className="text-sm font-medium">v{update.version}</span>
                      <Badge variant={getUpdateBadgeVariant(update.type)} className="text-xs">
                        {update.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{update.date}</span>
                  </div>

                  <h5 className="text-sm font-medium">{update.title}</h5>

                  <ul className="space-y-1">
                    {update.changes.map((change) => (
                      <li key={`${update.version}-${update.date}-${change}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1 text-green-500">-</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t pt-2">
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
