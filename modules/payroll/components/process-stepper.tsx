"use client"

import { IconCircleCheckFilled, IconProgress } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

type ProcessStepperProps = {
  currentStep: number
  steps: Array<{ stepNumber: number; title: string }>
}

export function ProcessStepper({ currentStep, steps }: ProcessStepperProps) {
  const gridColumnsClass =
    steps.length === 6
      ? "grid-cols-6"
      : steps.length === 8
        ? "grid-cols-8"
        : "grid-cols-6"

  return (
    <div className="w-full">
      <div className={cn("grid w-full border-b border-border/60", gridColumnsClass)}>
        {steps.map((step) => {
          const isCompleted = step.stepNumber < currentStep
          const isCurrent = step.stepNumber === currentStep
          const isFuture = step.stepNumber > currentStep

          return (
            <div
              key={step.stepNumber}
              className={cn(
                "relative flex flex-col items-center justify-center border-r border-border/60 px-2 py-2 transition-all last:border-r-0",
                isCurrent ? "bg-muted/30" : "bg-transparent",
                isFuture ? "opacity-70" : "opacity-100"
              )}
            >
              {isCurrent ? <div className="absolute bottom-0 left-0 h-[2px] w-full bg-primary" /> : null}
              {isCompleted ? <div className="absolute bottom-0 left-0 h-[2px] w-full bg-emerald-600" /> : null}

              <div className="mb-0.5 flex items-center gap-1.5">
                {isCompleted ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-primary-foreground">
                    <IconCircleCheckFilled className="h-3 w-3" />
                  </span>
                ) : isCurrent ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconProgress className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">{`0${step.stepNumber}`}</span>
                )}
                <span
                  className={cn(
                    "whitespace-nowrap text-[12px] font-semibold uppercase tracking-wide",
                    isCompleted ? "text-emerald-700" : isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
