import { Skeleton } from "@/components/ui/skeleton"

export default function PayrollPayslipsLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-44" />
          </div>
          <Skeleton className="h-4 w-[520px] max-w-full" />
        </div>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-6">
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={String(index)} className="space-y-2 bg-background px-3 py-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="border-b border-border/60 px-4 py-3">
            <Skeleton className="h-5 w-56" />
          </div>

          <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="space-y-3 border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
              <Skeleton className="h-9 w-full" />
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={String(index)} className="flex items-start gap-2 border border-border/60 px-3 py-2">
                    <Skeleton className="h-9 w-9 shrink-0" />
                    <div className="min-w-0 space-y-1.5">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <section className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>

              <div className="overflow-x-auto border border-border/60">
                <table className="w-full min-w-[860px]">
                  <thead className="bg-muted/20">
                    <tr className="border-b border-border/60">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <th key={String(index)} className="px-3 py-2 text-left">
                          <Skeleton className="h-3 w-16" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }).map((_, index) => (
                      <tr key={String(index)} className="border-b border-border/50">
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-24" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-20" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-24" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-16" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-16" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-16" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-3 w-20" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Skeleton className="h-8 w-8" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <Skeleton className="h-3 w-16" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
