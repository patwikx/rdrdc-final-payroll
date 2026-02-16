"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconChevronsDown,
  IconDownload,
  IconDeviceFloppy,
  IconInfoCircle,
  IconLoader2,
  IconPlugConnected,
  IconPlus,
  IconServer,
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import {
  applyBiometricDeviceSyncAction,
  connectBiometricDeviceAction,
  detectBiometricEnrollmentResultAction,
  pullBiometricDeviceLogsAction,
  startBiometricEnrollmentSessionAction,
  upsertBiometricDeviceAction,
} from "@/modules/attendance/sync/actions/biometric-device-actions"
import type { DeviceCardItem } from "@/modules/attendance/sync/utils/device-sync-shared"

type SyncBiometricsDevicePageProps = {
  companyName: string
  companyId: string
  initialDevices: DeviceCardItem[]
  initialEmployees: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
  }>
}

type DeviceFormState = {
  deviceId?: string
  code: string
  name: string
  deviceModel: string
  ipAddress: string
  port: string
  timeoutMs: string
  inport: string
  locationName: string
  commKey: string
  clearCommKey: boolean
}

type SyncSummary = {
  pulledLogs: number
  inRangeLogs: number
  outOfRangeLogs: number
  invalidLogs: number
  linesPrepared: number
  skippedLogs: number
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  parseErrors: Array<{ line: string; reason: string }>
  validationErrors: Array<{ employeeNumber: string; date: string; reason: string }>
  previewLines: string[]
  previewTruncated: boolean
  streamMode: "RAW" | "NORMALIZED"
}

const todayPh = toPhDateInputValue(new Date())
const weekAgoPh = (() => {
  const anchor = new Date()
  anchor.setDate(anchor.getDate() - 7)
  return toPhDateInputValue(anchor)
})()

const buildBlankForm = (): DeviceFormState => ({
  code: "",
  name: "",
  deviceModel: "ZKTeco K40",
  ipAddress: "",
  port: "4370",
  timeoutMs: "15000",
  inport: "5200",
  locationName: "",
  commKey: "",
  clearCommKey: false,
})

const toFormFromDevice = (device: DeviceCardItem): DeviceFormState => ({
  deviceId: device.id,
  code: device.code,
  name: device.name,
  deviceModel: device.deviceModel,
  ipAddress: device.ipAddress,
  port: String(device.port),
  timeoutMs: String(device.timeoutMs),
  inport: device.inport ? String(device.inport) : "",
  locationName: device.locationName ?? "",
  commKey: "",
  clearCommKey: false,
})

const formatDisplayDate = (value: string): string => {
  const parsed = parsePhDateInputToPhDate(value)
  if (!parsed) return "Select date"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const formatDateTime = (value: string | null): string => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

export function SyncBiometricsDevicePage({ companyName, companyId, initialDevices, initialEmployees }: SyncBiometricsDevicePageProps) {
  const [devices, setDevices] = useState<DeviceCardItem[]>(initialDevices)
  const [employees] = useState(initialEmployees)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(initialDevices[0]?.id ?? null)
  const [form, setForm] = useState<DeviceFormState>(() =>
    initialDevices[0] ? toFormFromDevice(initialDevices[0]) : buildBlankForm()
  )

  const [dateFrom, setDateFrom] = useState(weekAgoPh)
  const [dateTo, setDateTo] = useState(todayPh)

  const [isSavePending, startSaveTransition] = useTransition()
  const [isConnectPending, startConnectTransition] = useTransition()
  const [isStartSessionPending, startStartSessionTransition] = useTransition()
  const [isDetectResultPending, startDetectResultTransition] = useTransition()
  const [isPullPending, startPullTransition] = useTransition()
  const [isApplyPending, startApplyTransition] = useTransition()
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false)
  const [selectedEnrollmentEmployeeId, setSelectedEnrollmentEmployeeId] = useState<string | null>(null)
  const [enrollmentSessionId, setEnrollmentSessionId] = useState<string | null>(null)
  const [enrollmentStatus, setEnrollmentStatus] = useState<{
    status: "idle" | "session_started" | "detected"
    message: string
    employeeId: string
    employeeName: string
    employeeNumber: string
    baselineUserCount: number | null
    biometricId: string | null
    deviceUserId: string | null
    deviceUid: string | null
  } | null>(null)
  const [scanHintStep, setScanHintStep] = useState(0)

  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [stagedSyncLogId, setStagedSyncLogId] = useState<string | null>(null)
  const [streamLines, setStreamLines] = useState<string[]>([])
  const [streamStatusLines, setStreamStatusLines] = useState<string[]>([])
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamTextTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const enrollmentHintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoDetectInFlightRef = useRef(false)

  const selectedDevice = useMemo(
    () => devices.find((item) => item.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  )
  const selectedEnrollmentEmployee = useMemo(
    () => employees.find((item) => item.id === selectedEnrollmentEmployeeId) ?? null,
    [employees, selectedEnrollmentEmployeeId]
  )

  const stopStreamTimers = () => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current)
      streamTimerRef.current = null
    }
    if (streamTextTimerRef.current) {
      clearInterval(streamTextTimerRef.current)
      streamTextTimerRef.current = null
    }
  }

  const stopEnrollmentHintTimer = () => {
    if (enrollmentHintTimerRef.current) {
      clearInterval(enrollmentHintTimerRef.current)
      enrollmentHintTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopStreamTimers()
      stopEnrollmentHintTimer()
    }
  }, [])

  const applyDeviceToList = useCallback((device: DeviceCardItem) => {
    setDevices((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === device.id)
      if (existingIndex === -1) {
        return [device, ...previous]
      }

      const next = [...previous]
      next[existingIndex] = device
      return next
    })
  }, [])

  const selectDevice = (device: DeviceCardItem) => {
    setSelectedDeviceId(device.id)
    setForm(toFormFromDevice(device))
    setSelectedEnrollmentEmployeeId(null)
    setEnrollmentSessionId(null)
    setEnrollmentStatus(null)
    setScanHintStep(0)
    setSummary(null)
    setStagedSyncLogId(null)
    stopStreamTimers()
    setStreamLines([])
    setStreamStatusLines([])
  }

  const resetForNewDevice = () => {
    setSelectedDeviceId(null)
    setForm(buildBlankForm())
    setSelectedEnrollmentEmployeeId(null)
    setEnrollmentSessionId(null)
    setEnrollmentStatus(null)
    setScanHintStep(0)
    setSummary(null)
    setStagedSyncLogId(null)
    stopStreamTimers()
    setStreamLines([])
    setStreamStatusLines([])
  }

  const setFormField = <K extends keyof DeviceFormState>(key: K, value: DeviceFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const saveDevice = () => {
    startSaveTransition(async () => {
      const result = await upsertBiometricDeviceAction({
        companyId,
        deviceId: form.deviceId,
        code: form.code,
        name: form.name,
        deviceModel: form.deviceModel,
        ipAddress: form.ipAddress,
        port: Number(form.port),
        timeoutMs: Number(form.timeoutMs),
        inport: form.inport ? Number(form.inport) : undefined,
        locationName: form.locationName || undefined,
        commKey: form.commKey || undefined,
        clearCommKey: form.clearCommKey,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      applyDeviceToList(result.device)
      selectDevice(result.device)
      setForm((previous) => ({
        ...previous,
        commKey: "",
        clearCommKey: false,
      }))
      toast.success(result.message)
    })
  }

  const connectDevice = () => {
    if (!selectedDeviceId) {
      toast.error("Select a saved biometric device first.")
      return
    }

    startConnectTransition(async () => {
      const result = await connectBiometricDeviceAction({
        companyId,
        deviceId: selectedDeviceId,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      applyDeviceToList(result.device)
      toast.success(result.message)
    })
  }

  const startEnrollmentSession = () => {
    if (!selectedDeviceId) {
      toast.error("Select a saved biometric device first.")
      return
    }
    if (!selectedEnrollmentEmployeeId) {
      toast.error("Select employee first.")
      return
    }

    startStartSessionTransition(async () => {
      const result = await startBiometricEnrollmentSessionAction({
        companyId,
        deviceId: selectedDeviceId,
        employeeId: selectedEnrollmentEmployeeId,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      applyDeviceToList(result.device)
      setEnrollmentSessionId(result.sessionId)
      setScanHintStep(1)
      setEnrollmentStatus({
        status: "session_started",
        message: result.message,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        employeeNumber: result.employeeNumber,
        baselineUserCount: result.baselineUserCount,
        biometricId: null,
        deviceUserId: null,
        deviceUid: null,
      })
      setStreamStatusLines((previous) =>
        [...previous, `ENROLLMENT SESSION STARTED FOR ${result.employeeNumber}. SCAN ON DEVICE NOW...`].slice(-16)
      )
      toast.success(result.message)
    })
  }

  const detectEnrollmentResultInternal = useCallback(async (options?: { silent?: boolean }) => {
    if (!selectedDeviceId || !enrollmentSessionId) return
    if (autoDetectInFlightRef.current) return

    autoDetectInFlightRef.current = true
    try {
      const result = await detectBiometricEnrollmentResultAction({
        companyId,
        deviceId: selectedDeviceId,
        sessionId: enrollmentSessionId,
      })

      if (!result.ok) {
        if (!options?.silent) {
          toast.error(result.error)
        }
        return
      }

      applyDeviceToList(result.device)

      if (result.status === "pending") {
        setEnrollmentStatus((previous) => ({
          status: "session_started",
          message: result.message,
          employeeId: result.employeeId,
          employeeName: result.employeeName,
          employeeNumber: result.employeeNumber,
          baselineUserCount: previous?.baselineUserCount ?? null,
          biometricId: null,
          deviceUserId: null,
          deviceUid: null,
        }))
        if (!options?.silent) {
          toast(result.message)
        }
        return
      }

      setEnrollmentStatus((previous) => ({
        status: "detected",
        message: result.message,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        employeeNumber: result.employeeNumber,
        baselineUserCount: previous?.baselineUserCount ?? null,
        biometricId: result.biometricId,
        deviceUserId: result.deviceUserId,
        deviceUid: result.deviceUid,
      }))
      setScanHintStep(3)
      setEnrollmentSessionId(null)
      setStreamStatusLines((previous) =>
        [...previous, `ENROLLMENT DETECTED: ${result.employeeNumber} => ${result.biometricId}`].slice(-16)
      )
      toast.success(result.message)
    } finally {
      autoDetectInFlightRef.current = false
    }
  }, [companyId, enrollmentSessionId, selectedDeviceId, applyDeviceToList])

  const detectEnrollmentResult = () => {
    if (!selectedDeviceId) {
      toast.error("Select a saved biometric device first.")
      return
    }
    if (!enrollmentSessionId) {
      toast.error("Start an enrollment session first.")
      return
    }

    startDetectResultTransition(async () => {
      await detectEnrollmentResultInternal({ silent: false })
    })
  }

  useEffect(() => {
    stopEnrollmentHintTimer()
    if (!enrollmentSessionId) {
      setScanHintStep(0)
      return
    }

    enrollmentHintTimerRef.current = setInterval(() => {
      setScanHintStep((previous) => {
        if (previous >= 3) return 3
        return previous + 1
      })
    }, 7000)

    return () => {
      stopEnrollmentHintTimer()
    }
  }, [enrollmentSessionId])

  useEffect(() => {
    if (!enrollmentSessionId || !selectedDeviceId) {
      return
    }

    const intervalId = setInterval(() => {
      void detectEnrollmentResultInternal({ silent: true })
    }, 5000)

    return () => {
      clearInterval(intervalId)
    }
  }, [enrollmentSessionId, selectedDeviceId, detectEnrollmentResultInternal])

  const streamPreviewLines = (lines: string[]) => {
    stopStreamTimers()
    setStreamLines([])

    let index = 0
    streamTimerRef.current = setInterval(() => {
      if (index >= lines.length) {
        stopStreamTimers()
        return
      }

      const nextChunk = lines.slice(index, index + 12)
      index += 12
      setStreamLines((previous) => [...previous, ...nextChunk])
    }, 45)
  }

  const startPullStatusTicker = () => {
    stopStreamTimers()
    const steps = [
      "CONNECTING TO DEVICE...",
      "REQUESTING ATTENDANCE TRANSACTIONS...",
      "NORMALIZING PUNCH EVENTS...",
      "FILTERING BY DATE RANGE...",
      "STAGING LOGS FOR MANUAL DTR SYNC...",
    ]

    let index = 0
    setStreamStatusLines(["PULL SESSION STARTED..."])
    streamTextTimerRef.current = setInterval(() => {
      if (index >= steps.length) {
        if (streamTextTimerRef.current) {
          clearInterval(streamTextTimerRef.current)
          streamTextTimerRef.current = null
        }
        return
      }
      const next = steps[index]
      index += 1
      setStreamStatusLines((previous) => {
        const merged = [...previous, next]
        return merged.slice(-14)
      })
    }, 280)
  }

  const startApplyStatusTicker = () => {
    stopStreamTimers()
    const steps = [
      "READING STAGED LOGS...",
      "MATCHING EMPLOYEE NUMBER + DATE...",
      "APPLYING DTR UPSERT RULES...",
      "FINALIZING DTR SYNC RESULT...",
    ]

    let index = 0
    setStreamStatusLines(["DTR SYNC STARTED..."])
    streamTextTimerRef.current = setInterval(() => {
      if (index >= steps.length) {
        if (streamTextTimerRef.current) {
          clearInterval(streamTextTimerRef.current)
          streamTextTimerRef.current = null
        }
        return
      }
      const next = steps[index]
      index += 1
      setStreamStatusLines((previous) => {
        const merged = [...previous, next]
        return merged.slice(-14)
      })
    }, 280)
  }

  const pullDeviceLogs = () => {
    if (!selectedDeviceId) {
      toast.error("Select a saved biometric device first.")
      return
    }

    startPullTransition(async () => {
      setStagedSyncLogId(null)
      setSummary(null)
      setStreamLines([])
      startPullStatusTicker()

      const result = await pullBiometricDeviceLogsAction({
        companyId,
        deviceId: selectedDeviceId,
        dateFrom,
        dateTo,
      })

      if (!result.ok) {
        stopStreamTimers()
        setStreamStatusLines((previous) => [...previous, `FAILED: ${result.error}`].slice(-16))
        toast.error(result.error)
        return
      }

      applyDeviceToList(result.device)
      setStagedSyncLogId(result.summary.linesPrepared > 0 ? result.syncLogId : null)
      setSummary(result.summary)
      setStreamStatusLines((previous) => {
        if (result.summary.linesPrepared > 0) {
          return [...previous, "PULL COMPLETED. READY FOR DTR SYNC."].slice(-16)
        }
        if (result.summary.inRangeLogs === 0) {
          return [...previous, "PULL COMPLETED. NO LOGS IN SELECTED DATE RANGE."].slice(-16)
        }
        return [...previous, "PULL COMPLETED. IN-RANGE LOGS FOUND, BUT NONE WERE PREPARED."].slice(-16)
      })
      streamPreviewLines(result.summary.previewLines)
      toast.success(result.message)
    })
  }

  const applyPulledLogsToDtr = () => {
    if (!selectedDeviceId) {
      toast.error("Select a saved biometric device first.")
      return
    }

    if (!stagedSyncLogId) {
      toast.error("Pull logs first before syncing to employee DTR.")
      return
    }

    startApplyTransition(async () => {
      setStreamLines([])
      startApplyStatusTicker()

      const result = await applyBiometricDeviceSyncAction({
        companyId,
        deviceId: selectedDeviceId,
        syncLogId: stagedSyncLogId,
      })

      if (!result.ok) {
        stopStreamTimers()
        setStreamStatusLines((previous) => [...previous, `FAILED: ${result.error}`].slice(-16))
        toast.error(result.error)
        return
      }

      applyDeviceToList(result.device)
      setSummary(result.summary)
      setStagedSyncLogId(null)
      setStreamStatusLines((previous) => [...previous, "DTR SYNC COMPLETED."].slice(-16))
      streamPreviewLines(result.summary.previewLines)
      toast.success(result.message)
    })
  }

  const totalErrors = (summary?.parseErrors.length ?? 0) + (summary?.validationErrors.length ?? 0)

  return (
    <div className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Human Resources</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconServer className="size-6 text-primary" />
                Biometric Device Sync
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {companyName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Save device profiles, test connection, pull logs for preview, then manually sync and match to employee DTR.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/${companyId}/attendance/sync-biometrics`}>
              <Button variant="outline" className="gap-2">
                <IconArrowLeft className="size-3.5" />
                Upload Import
              </Button>
            </Link>
            <Link href={`/${companyId}/attendance/dtr`}>
              <Button variant="outline" className="gap-2">
                <IconArrowLeft className="size-3.5" />
                Back to DTR
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="grid gap-3 p-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="border border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <p className="text-sm font-medium text-foreground">Biometric Devices</p>
            <Button size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={resetForNewDevice}>
              <IconPlus className="size-3.5" /> New
            </Button>
          </div>

          <ScrollArea className="h-[300px] border-b border-border/60">
            <div className="space-y-1 p-2">
              {devices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => selectDevice(device)}
                  className={cn(
                    "w-full border border-border/60 px-2 py-2 text-left transition-colors",
                    selectedDeviceId === device.id && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className={cn("text-xs", selectedDeviceId === device.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{device.code}</p>
                    </div>
                    <Badge variant={device.isOnline ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">
                      {device.isOnline ? "ONLINE" : "OFFLINE"}
                    </Badge>
                  </div>
                  <p className={cn("mt-1 text-xs", selectedDeviceId === device.id ? "text-primary-foreground/90" : "text-muted-foreground")}>{device.ipAddress}:{String(device.port)} • {device.deviceModel}</p>
                </button>
              ))}
              {devices.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">No saved biometric devices yet.</p>
              ) : null}
            </div>
          </ScrollArea>

          <div className="space-y-2 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {form.deviceId ? "Edit Device" : "New Device"}
            </p>
            <div className="space-y-1.5">
              <Label>Device Code<span className="ml-1 text-destructive">*</span></Label>
              <Input value={form.code} onChange={(event) => setFormField("code", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Device Name<span className="ml-1 text-destructive">*</span></Label>
              <Input value={form.name} onChange={(event) => setFormField("name", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Model<span className="ml-1 text-destructive">*</span></Label>
              <Input value={form.deviceModel} onChange={(event) => setFormField("deviceModel", event.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Device Host / IP<span className="ml-1 text-destructive">*</span></Label>
                <Input value={form.ipAddress} onChange={(event) => setFormField("ipAddress", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input type="number" value={form.port} onChange={(event) => setFormField("port", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Timeout (ms)</Label>
                <Input type="number" value={form.timeoutMs} onChange={(event) => setFormField("timeoutMs", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Inport</Label>
                <Input type="number" value={form.inport} onChange={(event) => setFormField("inport", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.locationName} onChange={(event) => setFormField("locationName", event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Comm Key</Label>
              <Input type="password" value={form.commKey} onChange={(event) => setFormField("commKey", event.target.value)} placeholder={selectedDevice?.hasSavedCredential ? "Saved key exists. Type to replace." : "Optional"} />
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={form.clearCommKey}
                onCheckedChange={(value) => setFormField("clearCommKey", value === true)}
              />
              <span>Clear saved key</span>
            </div>
            <Button className="w-full gap-2" onClick={saveDevice} disabled={isSavePending}>
              {isSavePending ? <IconLoader2 className="size-4 animate-spin" /> : <IconDeviceFloppy className="size-4" />}
              {form.deviceId ? "Update Device" : "Save Device"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <section className="border border-border/60 bg-background">
            <div className="grid gap-3 border-b border-border/60 px-4 py-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {selectedDevice ? `${selectedDevice.name} (${selectedDevice.ipAddress}:${String(selectedDevice.port)})` : "Select a device"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last online: {selectedDevice ? formatDateTime(selectedDevice.lastOnlineAt) : "-"} • Last sync: {selectedDevice ? formatDateTime(selectedDevice.lastSyncAt) : "-"}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.35fr]">
                <Button
                  variant="outline"
                  disabled={
                    !selectedDevice ||
                    isConnectPending ||
                    isPullPending ||
                    isApplyPending ||
                    isStartSessionPending ||
                    isDetectResultPending
                  }
                  onClick={connectDevice}
                  className="gap-2"
                >
                  {isConnectPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlugConnected className="size-4" />}
                  Connect
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !selectedDevice ||
                    isPullPending ||
                    isApplyPending ||
                    isConnectPending ||
                    isStartSessionPending ||
                    isDetectResultPending
                  }
                  onClick={pullDeviceLogs}
                  className="gap-2"
                >
                  {isPullPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconDownload className="size-4" />}
                  Pull Logs
                </Button>
                <Button
                  disabled={
                    !selectedDevice ||
                    !stagedSyncLogId ||
                    isApplyPending ||
                    isPullPending ||
                    isConnectPending ||
                    isStartSessionPending ||
                    isDetectResultPending
                  }
                  onClick={applyPulledLogsToDtr}
                  className="gap-2"
                >
                  {isApplyPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
                  Sync & Match Logs
                </Button>
              </div>
              <div className="sm:col-span-2 xl:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Pull only fetches logs for preview. DTR entries are created or updated only after clicking
                  {" "}
                  <span className="font-medium text-foreground">Sync &amp; Match Logs</span>.
                </p>
                {stagedSyncLogId ? (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Staged logs are ready for DTR sync.</p>
                ) : null}
                {summary && summary.linesPrepared === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.inRangeLogs === 0
                      ? "No device logs were found within the selected date range."
                      : "In-range logs were found, but none could be prepared as valid IN/OUT punch lines."}
                  </p>
                ) : null}
              </div>
              <div className="hidden sm:block">
                {summary ? (
                  <Badge variant="outline" className="h-7 px-2.5 text-xs">
                    {summary.linesPrepared > 0 && stagedSyncLogId ? "PULLED / STAGED" : "NO ACTIVE STAGED SYNC"}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-2 xl:max-w-[560px]">
              <div className="space-y-1.5">
                <Label>Date From<span className="ml-1 text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                      {formatDisplayDate(dateFrom)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parsePhDateInputToPhDate(dateFrom) ?? undefined}
                      onSelect={(value) => {
                        if (!value) return
                        setDateFrom(toPhDateInputValue(value))
                        setStagedSyncLogId(null)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>Date To<span className="ml-1 text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                      {formatDisplayDate(dateTo)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parsePhDateInputToPhDate(dateTo) ?? undefined}
                      onSelect={(value) => {
                        if (!value) return
                        setDateTo(toPhDateInputValue(value))
                        setStagedSyncLogId(null)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="border-t border-border/60 px-4 py-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>Enroll Fingerprint (Employee)<span className="ml-1 text-destructive">*</span></Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          aria-label="Enrollment flow info"
                        >
                          <IconInfoCircle className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6} className="max-w-xs text-xs leading-relaxed">
                        Start Session captures baseline users. Employee scans on device. Detect Result captures and links assigned AC No automatically.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Popover open={employeeComboboxOpen} onOpenChange={setEmployeeComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={employeeComboboxOpen}
                        className="h-9 w-full justify-between"
                        disabled={!selectedDevice || isStartSessionPending || isDetectResultPending || isPullPending || isApplyPending}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <IconUser className="h-4 w-4 text-primary" />
                          {selectedEnrollmentEmployee
                            ? `${selectedEnrollmentEmployee.lastName}, ${selectedEnrollmentEmployee.firstName} (${selectedEnrollmentEmployee.employeeNumber})`
                            : "Select employee..."}
                        </div>
                        <IconChevronsDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0 border-border/40 shadow-xl" align="start">
                      <Command>
                        <CommandInput placeholder="Search employee..." className="h-10" />
                        <CommandList className="max-h-[280px]">
                          <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No employees found.</CommandEmpty>
                          <CommandGroup>
                            {employees.map((employee) => (
                              <CommandItem
                                key={employee.id}
                                value={`${employee.lastName} ${employee.firstName} ${employee.employeeNumber}`}
                                onSelect={() => {
                                  setSelectedEnrollmentEmployeeId(employee.id)
                                  setEnrollmentSessionId(null)
                                  setEnrollmentStatus(null)
                                  setEmployeeComboboxOpen(false)
                                }}
                                className="cursor-pointer text-sm"
                              >
                                <IconCheck className={cn("mr-2 h-4 w-4", selectedEnrollmentEmployeeId === employee.id ? "opacity-100" : "opacity-0")} />
                                {employee.lastName}, {employee.firstName}
                                <span className="ml-2 text-muted-foreground">({employee.employeeNumber})</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:self-end">
                  <Button
                    type="button"
                    onClick={startEnrollmentSession}
                    disabled={
                      !selectedDevice ||
                      !selectedEnrollmentEmployeeId ||
                      isStartSessionPending ||
                      isDetectResultPending ||
                      isPullPending ||
                      isApplyPending
                    }
                    className="gap-2"
                  >
                    {isStartSessionPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
                    Start Session
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={detectEnrollmentResult}
                    disabled={
                      !selectedDevice ||
                      !enrollmentSessionId ||
                      isStartSessionPending ||
                      isDetectResultPending ||
                      isPullPending ||
                      isApplyPending
                    }
                    className="gap-2"
                  >
                    {isDetectResultPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconDownload className="size-4" />}
                    Detect Result
                  </Button>
                </div>
              </div>

              {enrollmentStatus ? (
                <div className="mt-3 border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                  <p className={cn("font-medium", enrollmentStatus.status === "detected" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {enrollmentStatus.message}
                  </p>
                  {enrollmentStatus.status === "session_started" ? (
                    <p className="mt-1 text-muted-foreground">
                      Waiting for 3 scans on device. Estimated progress: {Math.max(1, Math.min(3, scanHintStep))}/3.
                      {" "}
                      Auto-detect runs every 5 seconds.
                    </p>
                  ) : null}
                  <p className="mt-1 text-muted-foreground">
                    Session: {enrollmentSessionId ?? "Completed"}
                    {" • "}
                    Employee: {enrollmentStatus.employeeName} ({enrollmentStatus.employeeNumber})
                    {" • "}
                    Baseline Users: {enrollmentStatus.baselineUserCount ?? "-"}
                    {" • "}
                    Biometric ID: {enrollmentStatus.biometricId ?? "-"}
                    {" • "}
                    Device User ID: {enrollmentStatus.deviceUserId ?? "-"}
                    {" • "}
                    UID: {enrollmentStatus.deviceUid ?? "-"}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="border border-border/60 bg-background">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Live Preview Stream</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{summary?.streamMode ?? "RAW"}</Badge>
                  <Badge variant="outline">{streamLines.length} lines</Badge>
                </div>
              </div>
              <ScrollArea className="h-[420px] px-4 py-3">
                <div className="space-y-1 font-mono text-xs text-muted-foreground">
                  {streamStatusLines.map((line, index) => (
                    <p key={`status-${String(index)}`} className="text-primary">&gt;&gt; {line}</p>
                  ))}
                  {streamLines.map((line, index) => (
                    <p key={`line-${String(index)}`}>{line}</p>
                  ))}
                  {summary?.previewTruncated ? (
                    <p className="pt-2 text-amber-600 dark:text-amber-400">Preview truncated to first {summary.previewLines.length} lines.</p>
                  ) : null}
                  {streamLines.length === 0 && streamStatusLines.length === 0 ? (
                    <p>No sync stream yet.</p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="border border-border/60 bg-background">
              <div className="border-b border-border/60 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Sync Summary</p>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm">
                <Metric label="Fetched Logs" value={summary?.pulledLogs ?? 0} />
                <Metric label="In Range" value={summary?.inRangeLogs ?? 0} />
                <Metric label="Out of Range" value={summary?.outOfRangeLogs ?? 0} />
                <Metric label="Invalid Logs" value={summary?.invalidLogs ?? 0} />
                <Metric label="Prepared Lines" value={summary?.linesPrepared ?? 0} />
                <Metric label="Created" value={summary?.recordsCreated ?? 0} />
                <Metric label="Updated" value={summary?.recordsUpdated ?? 0} />
                <Metric label="Skipped Logs" value={summary?.skippedLogs ?? 0} />
                <Metric label="Skipped Records" value={summary?.recordsSkipped ?? 0} />
                <Metric label="Errors" value={totalErrors} tone={totalErrors > 0 ? "warn" : "default"} />
              </div>
              <Separator />
              <div className="space-y-2 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Validation / Parse Issues</p>
                <ScrollArea className="h-[180px] border border-border/60 bg-muted/20 px-2 py-2">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {summary?.parseErrors.map((entry, index) => (
                      <p key={`parse-${String(index)}`}>Parse: {entry.reason} | {entry.line}</p>
                    ))}
                    {summary?.validationErrors.map((entry, index) => (
                      <p key={`validation-${String(index)}`}>Validation: {entry.employeeNumber} ({entry.date}) - {entry.reason}</p>
                    ))}
                    {!summary || (summary.parseErrors.length === 0 && summary.validationErrors.length === 0) ? (
                      <p>No errors.</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warn"
}) {
  return (
    <div className="flex items-center justify-between border border-border/60 px-2 py-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</p>
    </div>
  )
}
