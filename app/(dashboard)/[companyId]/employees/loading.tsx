import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function EmployeeMasterlistLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="border-b border-border/60">
        <section className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-6 w-24" />
              </div>
              <Skeleton className="h-3 w-96 max-w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <Card className="border-border/70 py-0">
            <CardHeader className="space-y-2 pb-2 pt-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <Skeleton className="h-9 w-full" />
              <div className="flex gap-1.5">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-7 w-16" />
              </div>
            </CardContent>
          </Card>

          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={String(index)} className="border-border/70 py-0">
              <CardHeader className="pb-2 pt-4">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-[92%]" />
                <Skeleton className="h-7 w-[88%]" />
                <Skeleton className="h-7 w-[84%]" />
              </CardContent>
            </Card>
          ))}
        </aside>

        <Card className="border-border/70 py-0">
          <CardHeader className="space-y-2 border-b border-border/60 pb-2.5 pt-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>

          <CardContent className="space-y-0 p-0">
            <div className="border-b border-border/60 px-6 py-3">
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={String(index)}
                  className="grid grid-cols-[minmax(260px,_2.2fr)_minmax(180px,_1.4fr)_minmax(150px,_1.1fr)_120px_minmax(180px,_1fr)] items-center gap-5 px-6 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-20" />
                  <div className="flex justify-end">
                    <Skeleton className="h-7 w-24" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex h-11 items-center justify-between px-6">
              <Skeleton className="h-3 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-7 w-14" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
