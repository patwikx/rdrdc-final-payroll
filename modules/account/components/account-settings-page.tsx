"use client"

import { useState, useTransition } from "react"
import {
  IconAt,
  IconCheck,
  IconLock,
  IconShieldLock,
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { changeOwnPasswordAction } from "@/modules/account/actions/change-own-password-action"
import { updateOwnProfileAction } from "@/modules/account/actions/update-own-profile-action"

type AccountSettingsPageProps = {
  companyId: string
  companyName: string
  initialProfile: {
    firstName: string
    lastName: string
    email: string
  }
}

type ProfileFormState = {
  firstName: string
  lastName: string
  email: string
}

type PasswordFormState = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const Required = () => <span className="ml-1 text-destructive">*</span>

export function AccountSettingsPage({ companyId, companyName, initialProfile }: AccountSettingsPageProps) {
  const [savedProfile, setSavedProfile] = useState<ProfileFormState>(initialProfile)
  const [profile, setProfile] = useState<ProfileFormState>(initialProfile)
  const [passwords, setPasswords] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isProfilePending, startProfileTransition] = useTransition()
  const [isPasswordPending, startPasswordTransition] = useTransition()

  const updateProfileField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setProfile((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const updatePasswordField = <K extends keyof PasswordFormState>(key: K, value: PasswordFormState[K]) => {
    setPasswords((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const resetProfile = () => {
    setProfile(savedProfile)
  }

  const submitProfile = () => {
    startProfileTransition(async () => {
      const result = await updateOwnProfileAction({
        companyId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const updatedProfile = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
      }
      setSavedProfile(updatedProfile)
      setProfile(updatedProfile)
      toast.success(result.message)
    })
  }

  const submitPassword = () => {
    startPasswordTransition(async () => {
      const result = await changeOwnPasswordAction({
        companyId,
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      toast.success(result.message)
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-300 bg-background">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">User Preferences</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconUser className="size-6 text-primary" />
                Account Settings
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                {companyName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Update your profile information and password for your current account.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-4 border border-border/70 bg-card px-4 py-4 sm:px-5">
          <div className="space-y-1">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <IconAt className="size-4 text-primary" />
              Profile Information
            </h2>
            <p className="text-sm text-muted-foreground">These details are used for your login identity and account display.</p>
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-first-name">
                First Name
                <Required />
              </Label>
              <Input
                id="account-first-name"
                value={profile.firstName}
                onChange={(event) => updateProfileField("firstName", event.target.value)}
                disabled={isProfilePending}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-last-name">
                Last Name
                <Required />
              </Label>
              <Input
                id="account-last-name"
                value={profile.lastName}
                onChange={(event) => updateProfileField("lastName", event.target.value)}
                disabled={isProfilePending}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-email">
              Email Address
              <Required />
            </Label>
            <Input
              id="account-email"
              type="email"
              value={profile.email}
              onChange={(event) => updateProfileField("email", event.target.value)}
              disabled={isProfilePending}
              autoComplete="email"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetProfile} disabled={isProfilePending}>
              Reset
            </Button>
            <Button type="button" onClick={submitProfile} disabled={isProfilePending}>
              <IconCheck className="size-4" />
              {isProfilePending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </section>

        <section className="space-y-4 border border-border/70 bg-card px-4 py-4 sm:px-5">
          <div className="space-y-1">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <IconShieldLock className="size-4 text-primary" />
              Password & Security
            </h2>
            <p className="text-sm text-muted-foreground">Use your current password to confirm sensitive account changes.</p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="account-current-password">
              Current Password
              <Required />
            </Label>
            <Input
              id="account-current-password"
              type="password"
              value={passwords.currentPassword}
              onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
              disabled={isPasswordPending}
              autoComplete="current-password"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-new-password">
                New Password
                <Required />
              </Label>
              <Input
                id="account-new-password"
                type="password"
                value={passwords.newPassword}
                onChange={(event) => updatePasswordField("newPassword", event.target.value)}
                disabled={isPasswordPending}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-confirm-password">
                Confirm Password
                <Required />
              </Label>
              <Input
                id="account-confirm-password"
                type="password"
                value={passwords.confirmPassword}
                onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
                disabled={isPasswordPending}
                autoComplete="new-password"
              />
            </div>
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <IconLock className="size-3.5" />
            Passwords must be at least 8 characters and should not be reused.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPasswords({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                })
              }
              disabled={isPasswordPending}
            >
              Clear
            </Button>
            <Button type="button" onClick={submitPassword} disabled={isPasswordPending}>
              <IconCheck className="size-4" />
              {isPasswordPending ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
