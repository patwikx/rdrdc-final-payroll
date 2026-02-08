import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IconListDetails } from "@tabler/icons-react"
import type { OrganizationEntityListViewModel } from "@/modules/settings/organization/utils/get-organization-entity-list"

type OrganizationEntityListPageProps = {
  data: OrganizationEntityListViewModel
}

export function OrganizationEntityListPage({ data }: OrganizationEntityListPageProps) {
  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconListDetails className="size-5" /> {data.companyName} {data.entityLabel}</h1>
            <p className="text-xs text-muted-foreground">{data.entityDescription}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/${data.companyId}/settings/organization`}>Open Organization Setup</Link>
          </Button>
        </div>
      </header>

      <Card className="rounded-xl border border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{data.entityLabel} Records</CardTitle>
          <CardDescription>Company-scoped records for this organization module.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.rows.length === 0 ? (
            <p className="rounded-md border border-border/60 bg-background p-3 text-xs text-muted-foreground">
              No records found for {data.entityLabel.toLowerCase()}.
            </p>
          ) : (
            data.rows.map((row) => (
              <div key={row.id} className="rounded-md border border-border/60 bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.code} - {row.name}</p>
                    {row.description ? <p className="text-xs text-muted-foreground">{row.description}</p> : null}
                    {row.secondary ? <p className="text-xs text-muted-foreground">{row.secondary}</p> : null}
                  </div>
                  <Badge variant="outline">{row.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  )
}
