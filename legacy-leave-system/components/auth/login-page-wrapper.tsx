"use client"

import { useActionState, useEffect, Suspense } from "react"
import { useFormStatus } from "react-dom"
import { useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction } from "@/lib/auth-actions/login"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl"
      aria-disabled={pending}
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Signing in...
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  )
}

function SearchParamsHandler() {
  const searchParams = useSearchParams()

  // Handle force logout scenarios
  useEffect(() => {
    const error = searchParams.get('error')
    const shouldLogout = searchParams.get('logout') === 'true'

    if (shouldLogout && error) {
      const performLogout = async () => {
        let message = "Session expired. Please sign in again."
        
        switch (error) {
          case 'InvalidAccess':
            message = "Invalid access detected. Please sign in again."
            break
          case 'InvalidBusinessUnit':
            message = "Invalid business unit access. Please sign in again."
            break
          case 'UnauthorizedAccess':
            message = "Unauthorized access detected. Please sign in again."
            break
          case 'SessionInvalid':
            message = "Your session is invalid. Please sign in again."
            break
          case 'SecurityViolation':
            message = "Security violation detected. Please sign in again."
            break
        }

        try {
          toast.error(message)
          await signOut({ redirect: false })
        } catch (error) {
          console.error("Logout error:", error)
        }
      }

      performLogout()
    }
  }, [searchParams])

  return null
}

function LoginContent() {
  const [errorMessage, dispatch] = useActionState(loginAction, undefined)

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 dark:from-primary/20 dark:via-primary/10 dark:to-background">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        {/* Large decorative circles */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/15 dark:bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/25 dark:bg-primary/15 rounded-full blur-2xl animate-pulse delay-500"></div>
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-primary/20 dark:bg-primary/10 rounded-full blur-2xl animate-pulse delay-700"></div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground) / 0.3) 1px, transparent 0)`,
            backgroundSize: "20px 20px",
          }}
        ></div>

        {/* Subtle geometric shapes */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-primary-foreground/30 rounded-full animate-pulse delay-300"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-primary-foreground/40 rounded-full animate-pulse delay-1200"></div>
        <div className="absolute bottom-32 left-1/3 w-1.5 h-1.5 bg-primary-foreground/35 rounded-full animate-pulse delay-800"></div>
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-primary-foreground/30 rounded-full animate-pulse delay-400"></div>

        {/* Additional pattern elements */}
        <div className="absolute top-1/3 left-10 w-3 h-3 bg-primary-foreground/20 rounded-full animate-pulse delay-600"></div>
        <div className="absolute bottom-1/4 right-10 w-2.5 h-2.5 bg-primary-foreground/25 rounded-full animate-pulse delay-900"></div>
        <div className="absolute top-3/4 left-1/2 w-1.5 h-1.5 bg-primary-foreground/30 rounded-full animate-pulse delay-1100"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-foreground mb-3 drop-shadow-lg">RD Realty Group - LMS</h1>
            <p className="text-primary-foreground/90 text-lg font-medium">Sign in to access your dashboard</p>
          </div>

          {/* Login Card */}
          <Card className="border shadow-2xl bg-card/95 backdrop-blur-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-card/50 to-card/30 pointer-events-none"></div>
            <CardHeader className="pb-6 relative">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-card-foreground mb-2">Welcome back! 👋</h2>
                <p className="text-muted-foreground font-medium">Enter your credentials to continue</p>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 relative">
              <form action={dispatch} className="space-y-6">
                {/* Employee ID */}
                <div className="space-y-3">
                  <Label htmlFor="employeeId" className="text-sm font-semibold text-foreground">
                    Employee ID
                  </Label>
                  <Input
                    id="employeeId"
                    name="employeeId"
                    type="text"
                    placeholder="Z-123"
                    required
                    className="h-12 bg-background/80 backdrop-blur-sm text-base font-medium transition-all duration-200"
                  />
                </div>

                {/* Password */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                      Password
                    </Label>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    className="h-12 bg-background/80 backdrop-blur-sm text-base font-medium transition-all duration-200"
                  />
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="flex items-start gap-3 p-4 bg-destructive/10 backdrop-blur-sm border border-destructive/20 rounded-xl shadow-sm">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-destructive mb-1">Authentication failed</h3>
                      <p className="text-sm text-destructive/80">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <SubmitButton />
                </div>
              </form>

              {/* Support Contact */}
              <div className="mt-4 pt-6 border-t border-border text-center">
                <p className="text-sm text-muted-foreground mb-3 font-medium">Need help accessing your account?</p>
                <Link
                  href="#"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-lg transition-all duration-200 border border-primary/20 hover:border-primary/30"
                >
                  Contact MIS Department
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-4 text-center whitespace-nowrap">
            <p className="text-sm text-primary-foreground/90 font-medium leading-relaxed">
              By signing in, you agree to our{" "}
              <Link
                href="#"
                className="text-primary-foreground hover:text-primary-foreground/80 font-semibold underline underline-offset-2 decoration-primary-foreground/70 hover:decoration-primary-foreground/90 transition-all duration-200"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="#"
                className="text-primary-foreground hover:text-primary-foreground/80 whitespace-nowrap font-semibold underline underline-offset-2 decoration-primary-foreground/70 hover:decoration-primary-foreground/90 transition-all duration-200"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-3 flex justify-center">
              <span className="text-xs font-mono text-primary-foreground/60 bg-primary-foreground/10 px-2 py-1 rounded">
                v2.1.1
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPageWrapper() {
  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsHandler />
      </Suspense>
      <LoginContent />
    </>
  )
}