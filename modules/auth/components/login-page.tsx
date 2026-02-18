"use client"

import {
  IconBuildingSkyscraper,
  IconChartBar,
  IconClock,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

const logoutReasonMessageMap: Record<string, string> = {
  inactive: "You were signed out due to 30 minutes of inactivity.",
  expired: "Your session expired. Please sign in again.",
  "invalid-session":
    "Your previous session is no longer valid. Please sign in again.",
}

const authErrorMessageMap: Record<string, string> = {
  CredentialsSignin: "Invalid credentials. Please try again.",
  AccessDenied: "Access denied. Please contact your administrator.",
  Configuration:
    "Authentication is not configured correctly. Please contact support.",
  Default: "Sign in failed. Please try again.",
}

const features = [
  {
    icon: IconUsers,
    title: "Employee Management",
    description: "Centralized records and profiles",
  },
  {
    icon: IconChartBar,
    title: "Payroll Processing",
    description: "Automated computation and compliance",
  },
  {
    icon: IconClock,
    title: "Time & Attendance",
    description: "DTR tracking and leave management",
  },
  {
    icon: IconShieldCheck,
    title: "Approval Workflows",
    description: "Multi-level request processing",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
} as const

const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.2 },
  },
}

const formItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
} as const

export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const nextPath = searchParams.get("next")
  const logoutReason = searchParams.get("reason")
  const authError = searchParams.get("error")
  const callbackPath = nextPath && nextPath.startsWith("/") ? nextPath : null
  const logoutReasonMessage = logoutReason
    ? logoutReasonMessageMap[logoutReason]
    : null
  const authErrorMessage = authError
    ? (authErrorMessageMap[authError] ?? authErrorMessageMap.Default)
    : null

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
      const callbackUrl = callbackPath ?? "/auth/post-login"
      let result: Awaited<ReturnType<typeof signIn>> | undefined
      try {
        result = await signIn("credentials", {
          identifier,
          password,
          callbackUrl,
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

      router.replace(result.url ?? callbackUrl)
    })
  }

  return (
    <main className="min-h-svh bg-background lg:grid lg:min-h-screen lg:grid-cols-2">
      {/* ─── Left Panel: Branding ─── */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-muted/30 p-10 lg:flex xl:p-14">
        {/* Decorative grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Decorative corner accent */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-border/50 bg-primary/5" />
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-border/50 bg-primary/5" />

        {/* Top content */}
        <motion.div
          className="relative space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider">
              <IconBuildingSkyscraper className="size-3" />
              RD Group of Companies
            </Badge>
          </motion.div>

          <motion.div className="space-y-2" variants={itemVariants}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground xl:text-3xl">
              RD REALTY GROUP
            </h1>
            <p className="text-sm text-muted-foreground">
              HR Information System
            </p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Separator />
          </motion.div>

          <motion.p
            className="max-w-sm text-xs leading-relaxed text-muted-foreground"
            variants={itemVariants}
          >
            A centralized workspace for payroll operations, employee records,
            time and attendance, and multi-level approval workflows.
          </motion.p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          className="relative mt-auto grid grid-cols-2 gap-3 pt-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                <CardContent className="space-y-2 pt-1">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                    <feature.icon className="size-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      {feature.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom identifiers */}
        <motion.div
          className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-6 text-[11px] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-1">
            <IconShieldCheck className="size-3 text-primary" />
            RD Realty Development Corporation
          </span>
          <span className="inline-flex items-center gap-1">
            <IconShieldCheck className="size-3 text-primary" />
            RD Hardware &amp; Fishing Supply, Inc.
          </span>
          <span className="inline-flex items-center gap-1">
            <IconShieldCheck className="size-3 text-primary" />
            Tropicana Worldwide Corporation
          </span>
        </motion.div>
      </section>

      {/* ─── Right Panel: Login Form ─── */}
      <section className="relative flex min-h-svh items-center justify-center overflow-hidden p-6 sm:p-10 lg:min-h-0">
        <motion.div
          className="relative w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Mobile-only branding */}
          <div className="mb-10 flex flex-col items-center space-y-2 text-center lg:hidden">
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider">
              <IconBuildingSkyscraper className="size-3" />
              RD Group of Companies
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              RD REALTY GROUP
            </h1>
            <p className="text-xs text-muted-foreground">
              HR Information System
            </p>
          </div>

          {/* Header */}
          <div className="mb-8 space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              Access your payroll and HR workspace.
            </p>
          </div>

          {/* Form */}
          <motion.form
            id="login-form"
            className="space-y-5"
            onSubmit={handleSubmit}
            variants={formContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Identifier field */}
            <motion.div className="space-y-2" variants={formItemVariants}>
              <Label htmlFor="identifier" className="text-xs font-medium">
                Work email or username
              </Label>
              <InputGroup className="h-9">
                <InputGroupAddon align="inline-start">
                  <IconMail className="size-4 text-muted-foreground/70" />
                </InputGroupAddon>
                <InputGroupInput
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@company.com"
                  required
                />
              </InputGroup>
            </motion.div>

            {/* Password field */}
            <motion.div className="space-y-2" variants={formItemVariants}>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Forgot password?
                </button>
              </div>
              <InputGroup className="h-9">
                <InputGroupAddon align="inline-start">
                  <IconLock className="size-4 text-muted-foreground/70" />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <IconEyeOff className="size-3.5 text-muted-foreground" />
                    ) : (
                      <IconEye className="size-3.5 text-muted-foreground" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </motion.div>

            {/* Remember me */}
            <motion.div variants={formItemVariants}>
              <Label
                htmlFor="remember"
                className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
              >
                <Checkbox id="remember" defaultChecked />
                Keep me signed in
              </Label>
            </motion.div>

            {/* Error / warning messages */}
            <AnimatePresence mode="wait">
              {errorMessage ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {errorMessage}
                  </div>
                </motion.div>
              ) : null}
              {!errorMessage && authErrorMessage ? (
                <motion.div
                  key="auth-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {authErrorMessage}
                  </div>
                </motion.div>
              ) : null}
              {!errorMessage && !authErrorMessage && logoutReasonMessage ? (
                <motion.div
                  key="logout-reason"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {logoutReasonMessage}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Submit button */}
            <motion.div variants={formItemVariants} className="pt-1">
              <Button
                className="h-9 w-full"
                size="lg"
                type="submit"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </motion.div>
          </motion.form>

          {/* Footer */}
          <Separator className="mt-8" />
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} RD Realty Group &middot; HR
            Information System
          </p>
        </motion.div>
      </section>
    </main>
  )
}
