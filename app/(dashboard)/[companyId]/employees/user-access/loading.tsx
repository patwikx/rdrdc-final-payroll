import { Skeleton } from "@/components/ui/skeleton"

export default function UserAccessLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <section className="border-b border-border/60">
        <div className="flex flex-col gap-2 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <Skeleton className="h-3 w-16" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <Skeleton className="h-9 w-full xl:w-[360px]" />
          <Skeleton className="h-9 w-full xl:w-[220px]" />
          <Skeleton className="h-9 w-full xl:w-[220px]" />
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      </section>

      <section className="px-4 py-4 sm:px-6 lg:px-8">
        <section className="overflow-hidden border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2 sm:px-6">
            <div className="inline-flex items-center gap-1 border border-border/70 bg-background p-1">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-8 w-36" />
          </div>

          <div className="overflow-x-auto bg-background">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="bg-muted/30">
                <tr>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <th key={String(index)} className="px-3 py-2 text-left">
                      <Skeleton className="h-3 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, index) => (
                  <tr key={String(index)} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-32" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-5 w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-5 w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-5 w-16" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end">
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-background px-3 py-2">
            <Skeleton className="h-3 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
