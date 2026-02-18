import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function CompanyDashboardLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="border-b border-border/60">
        <section className="w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-36" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-3 w-60" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-[170px]" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-40" />
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8 2xl:px-10">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={String(index)} className="border-border/70 py-0">
                <CardHeader className="space-y-2 pb-1.5 pt-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-14" />
                </CardHeader>
                <CardContent className="pb-3">
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/70 py-0">
            <CardHeader className="border-b border-border/60 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-5 py-2">
                <Skeleton className="h-3 w-full" />
              </div>
              <div className="divide-y divide-border/60">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={String(index)} className="grid min-h-10 grid-cols-[1.2fr_0.9fr_1fr_0.9fr_0.8fr_0.7fr] items-center gap-2 px-5 py-2.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-12" />
                    <div className="flex justify-end">
                      <Skeleton className="h-7 w-14" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/60 px-5 py-2">
                <Skeleton className="h-3 w-36" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-7 w-14" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="space-y-1.5 border-b border-border/60 pb-3 pt-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={String(index)} className="flex items-center justify-between px-5 py-2.5">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-14" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/60 px-5 py-2">
                <Skeleton className="h-3 w-36" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-7 w-14" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">
                <Skeleton className="h-4 w-28" />
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-3 w-44" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={String(index)} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))}
              <Skeleton className="h-px w-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-12" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">
                <Skeleton className="h-4 w-28" />
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-3 w-48" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={String(index)} className="flex items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">
                <Skeleton className="h-4 w-28" />
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-3 w-44" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={String(index)} className="flex items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  )
}
