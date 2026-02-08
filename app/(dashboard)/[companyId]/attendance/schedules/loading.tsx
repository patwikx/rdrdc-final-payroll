import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AttendanceSchedulesLoading() {
  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardContent className="space-y-2 px-4 py-4">
          <Skeleton className="h-5 w-60" />
          <Skeleton className="h-3 w-72" />
        </CardContent>
      </Card>
      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardContent className="space-y-2 px-4 py-4">
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
      <section className="grid gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={String(index)} className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
            <CardContent className="space-y-2 px-4 py-4">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-[180px] w-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
