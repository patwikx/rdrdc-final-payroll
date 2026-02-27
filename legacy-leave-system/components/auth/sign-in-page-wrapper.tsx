"use client"

import { useActionState, useEffect, Suspense } from "react"
import { useFormStatus } from "react-dom"
import { useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
      className="w-full h-10 sm:h-12 font-semibold text-sm sm:text-base"
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

function SignInContent() {
  const [errorMessage, dispatch] = useActionState(loginAction, undefined)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">RD Realty Group - LMS</h1>
          <p className="text-base sm:text-lg font-medium text-muted-foreground">Sign in to access your dashboard</p>
        </div>

        {/* Login Form */}
        <div className="mb-6">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Welcome back! 👋</h2>
            <p className="text-muted-foreground font-medium text-sm sm:text-base">Enter your credentials to continue</p>
          </div>

          <form action={dispatch} className="space-y-4 sm:space-y-6">
            {/* Employee ID */}
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="employeeId" className="text-sm font-semibold">
                Employee ID
              </Label>
              <Input
                id="employeeId"
                name="employeeId"
                type="text"
                placeholder="Z-123"
                required
                className="h-10 sm:h-12 text-sm sm:text-base font-medium"
              />
            </div>

            {/* Password */}
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                className="h-10 sm:h-12 text-sm sm:text-base font-medium"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-destructive mb-1">Authentication failed</h3>
                  <p className="text-sm text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="pt-1 sm:pt-2">
              <SubmitButton />
            </div>
          </form>

          {/* Support Contact */}
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 font-medium">Need help accessing your account?</p>
            <Link
              href="#"
              className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold hover:underline"
            >
              Contact MIS Department
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
            By signing in, you agree to our{" "}
            <Link
              href="#"
              className="hover:underline font-semibold"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="hover:underline font-semibold"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <div className="mt-3 flex justify-center">
            <span className="text-xs font-mono text-muted-foreground border px-2 py-1 rounded">
              v2.2.0
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignInPageWrapper() {
  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsHandler />
      </Suspense>
      <SignInContent />
    </>
  )
}