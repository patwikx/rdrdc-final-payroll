"use client"

import { IconFingerprint, IconShieldCheck } from "@tabler/icons-react"
import { getSession, signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const logoutReasonMessageMap: Record<string, string> = {
  inactive: "You were signed out due to 30 minutes of inactivity.",
  expired: "Your session expired. Please sign in again.",
  "invalid-session": "Your previous session is no longer valid. Please sign in again.",
}

const authErrorMessageMap: Record<string, string> = {
  CredentialsSignin: "Invalid credentials. Please try again.",
  AccessDenied: "Access denied. Please contact your administrator.",
  Configuration: "Authentication is not configured correctly. Please contact support.",
  Default: "Sign in failed. Please try again.",
}

export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const nextPath = searchParams.get("next")
  const logoutReason = searchParams.get("reason")
  const authError = searchParams.get("error")
  const callbackPath = nextPath && nextPath.startsWith("/") ? nextPath : null
  const logoutReasonMessage = logoutReason ? logoutReasonMessageMap[logoutReason] : null
  const authErrorMessage = authError ? authErrorMessageMap[authError] ?? authErrorMessageMap.Default : null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const identifier = formData.get("identifier")
    const password = formData.get("password")

    if (typeof identifier !== "string" || typeof password !== "string") {
      setErrorMessage("Invalid login payload.")
      return
    }

    setErrorMessage(null)

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof signIn>> | undefined
      try {
        result = await signIn("credentials", {
          identifier,
          password,
          redirect: false,
        })
      } catch (error) {
        console.error("Client sign-in failed:", error)
        setErrorMessage("Sign in failed. Please try again.")
        return
      }

      if (!result || result.error) {
        setErrorMessage("Invalid credentials. Please try again.")
        return
      }

      const session = await getSession()
      const companyId = session?.user?.selectedCompanyId ?? session?.user?.defaultCompanyId
      const role = session?.user?.companyRole ?? session?.user?.role ?? "COMPANY_ADMIN"

      if (callbackPath) {
        router.push(callbackPath)
        router.refresh()
        return
      }

      if (!companyId) {
        router.push("/logout?reason=invalid-session")
        router.refresh()
        return
      }

      const destination =
        role === "EMPLOYEE" ? `/${companyId}/employee-portal` : `/${companyId}/dashboard`

      router.push(destination)
      router.refresh()
    })
  }

  return (
    <main className="grid min-h-screen overflow-hidden bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative flex flex-col justify-between border-b border-border/70 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
        <div className="space-y-3">
          <h1 className="max-w-md text-2xl font-semibold text-foreground sm:text-3xl">
            RD REALTY GROUP <br /> HR Information System
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            A MEMBER OF RD GROUP OF COMPANIES
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="size-3.5 text-primary" />
            RD Realty Development Corporation
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="size-3.5 text-primary" />
            RD Hardware & Fishing Supply, Inc.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconFingerprint className="size-3.5 text-primary" />
            Tropicana Worldwide Corporation
          </span>
        </div>
      </section>

      <section className="grid place-items-center p-4 sm:p-8">
        <Card className="w-full max-w-sm border-border/70">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Access your payroll workspace securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Work email or username</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <Label htmlFor="remember" className="flex cursor-pointer items-center gap-2 pt-0.5">
                <Checkbox id="remember" defaultChecked />
                Keep me signed in
              </Label>

              {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
              {!errorMessage && authErrorMessage ? <p className="text-destructive text-xs">{authErrorMessage}</p> : null}
              {!errorMessage && !authErrorMessage && logoutReasonMessage ? (
                <p className="text-xs text-muted-foreground">{logoutReasonMessage}</p>
              ) : null}

              <Button className="w-full" size="lg" type="submit" disabled={isPending}>
                {isPending ? "Signing in..." : "Access dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
