import { Construction, ArrowLeft, Wrench, HardHat } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface MaterialRequestsReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function MaterialRequestsReportsPage({ params }: MaterialRequestsReportsPageProps) {
  const { businessUnitId } = await params;
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl text-center">
        {/* Icon Animation Container */}
        <div className="mb-8 flex justify-center items-center gap-4">
          <div className="animate-bounce">
            <Construction className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
          </div>
          <div className="animate-pulse delay-150">
            <Wrench className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
          </div>
          <div className="animate-bounce delay-300">
            <HardHat className="h-14 w-14 sm:h-18 sm:w-18 text-primary" />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-4 sm:space-y-6 mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            Under Construction
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
            We're working hard to bring you something amazing. This page is currently under construction and will be available soon.
          </p>

          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <span className="text-sm font-medium">In Progress</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/${businessUnitId}`} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="#">
              Contact Support
            </Link>
          </Button>
        </div>

        {/* Additional Info */}
        <div className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            Expected completion: <span className="font-semibold">Coming Soon</span>
          </p>
        </div>
      </div>
    </div>
  )
}