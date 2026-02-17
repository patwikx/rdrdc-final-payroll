"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconFileText,
  IconLoader2,
  IconShieldCheck,
  IconScan,
  IconUpload,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { syncBiometricsAction } from "@/modules/attendance/sync/actions/sync-biometrics-action"

type SyncBiometricsPageProps = {
  companyName: string
  companyId: string
}

const PREVIEW_MAX_LINES = 100
const PREVIEW_BYTE_LIMIT = 64 * 1024
const PROCESS_LOG_MAX_ITEMS = 12
const PROGRESS_TICK_INTERVAL_MS = 160
const PROGRESS_CEILING = 96
const PROCESS_LOG_STEPS = [
  "PARSING TIME ENTRIES...",
  "MATCHING EMPLOYEE RECORDS...",
  "VALIDATING TIME DATA...",
  "UPDATING DTR RECORDS...",
  "FINALIZING SYNC...",
]
const WAITING_LOG = "WAITING FOR SERVER RESPONSE..."

export function SyncBiometricsPage({ companyName, companyId }: SyncBiometricsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processLogTickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressTickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ processedCount: number } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [processLogs, setProcessLogs] = useState<string[]>([])
  const [syncProgress, setSyncProgress] = useState(0)

  const stopProcessLogTicker = () => {
    if (processLogTickerRef.current) {
      clearInterval(processLogTickerRef.current)
      processLogTickerRef.current = null
    }
  }

  const stopProgressTicker = () => {
    if (progressTickerRef.current) {
      clearInterval(progressTickerRef.current)
      progressTickerRef.current = null
    }
  }

  const startProgressTicker = () => {
    stopProgressTicker()
    progressTickerRef.current = setInterval(() => {
      setSyncProgress((previous) => {
        if (previous >= PROGRESS_CEILING) {
          return previous
        }
        const increment = 0.4 + Math.random() * 1.1
        return Math.min(PROGRESS_CEILING, previous + increment)
      })
    }, PROGRESS_TICK_INTERVAL_MS)
  }

  const startProcessLogTicker = () => {
    stopProcessLogTicker()
    let stepIndex = 0
    processLogTickerRef.current = setInterval(() => {
      if (stepIndex >= PROCESS_LOG_STEPS.length) {
        stopProcessLogTicker()
        setProcessLogs((previous) => {
          if (previous.includes(WAITING_LOG)) {
            return previous
          }
          const nextLogs = [...previous, WAITING_LOG]
          if (nextLogs.length <= PROCESS_LOG_MAX_ITEMS) {
            return nextLogs
          }
          return nextLogs.slice(-PROCESS_LOG_MAX_ITEMS)
        })
        return
      }

      const nextStep = PROCESS_LOG_STEPS[stepIndex]
      stepIndex += 1
      setProcessLogs((previous) => {
        const nextLogs = [...previous, nextStep]
        if (nextLogs.length <= PROCESS_LOG_MAX_ITEMS) {
          return nextLogs
        }
        return nextLogs.slice(-PROCESS_LOG_MAX_ITEMS)
      })
    }, 250)
  }

  useEffect(() => {
    return () => {
      stopProcessLogTicker()
      stopProgressTicker()
    }
  }, [])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".txt")) {
      toast.error("Please upload a valid .txt file")
      event.target.value = ""
      return
    }

    try {
      setSelectedFile(file)
      // Read only the first chunk for preview to keep file selection snappy on large exports.
      const previewChunk = await file.slice(0, PREVIEW_BYTE_LIMIT).text()
      const lines = previewChunk.split(/\r?\n/).slice(0, PREVIEW_MAX_LINES).join("\n")
      setFilePreview(lines)
    } catch {
      setSelectedFile(null)
      setFilePreview(null)
      event.target.value = ""
      toast.error("Unable to read file preview.")
    }
  }

  const handleSync = async () => {
    if (!selectedFile) return

    try {
      setLoading(true)
      setIsProcessing(true)
      setProcessLogs(["INITIALIZING IMPORT...", "READING ATTENDANCE FILE..."])
      setSyncProgress(6)
      startProcessLogTicker()
      startProgressTicker()

      const fullContent = await selectedFile.text()
      setSyncProgress((previous) => Math.max(previous, 18))

      const response = await syncBiometricsAction({ companyId, fileContent: fullContent })

      if (response.ok) {
        setProcessLogs((previous) => [...previous, "SYNC COMPLETED."])
        stopProcessLogTicker()
        stopProgressTicker()
        setSyncProgress(100)
        await new Promise((resolve) => setTimeout(resolve, 220))
        setSyncResult({ processedCount: response.data.recordsProcessed })
        setIsProcessing(false)
        toast.success(`Synchronized ${response.data.recordsProcessed} attendance records`)
      } else {
        stopProcessLogTicker()
        stopProgressTicker()
        setSyncProgress(0)
        setIsProcessing(false)
        toast.error(response.error || "Failed to sync biometrics")
      }
    } catch {
      stopProcessLogTicker()
      stopProgressTicker()
      setSyncProgress(0)
      setIsProcessing(false)
      toast.error("A system error occurred during synchronization")
    } finally {
      stopProcessLogTicker()
      stopProgressTicker()
      setLoading(false)
    }
  }

  const resetState = () => {
    setSelectedFile(null)
    setFilePreview(null)
    setSyncResult(null)
    setIsProcessing(false)
    setProcessLogs([])
    setSyncProgress(0)
    stopProcessLogTicker()
    stopProgressTicker()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="w-full min-h-screen bg-background animate-in fade-in duration-500">
      <div className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Human Resources</p>
          <div className="flex items-center gap-4">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconScan className="size-6 text-primary" /> Biometric Import
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuilding className="mr-1 size-3.5" />
              {companyName}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/${companyId}/attendance/sync-biometrics/device`}>
            <Button variant="outline" className="gap-2">
              Device Sync
            </Button>
          </Link>
          <Link href={`/${companyId}/attendance/dtr`}>
            <Button variant="outline" className="gap-2">
              <IconArrowLeft className="h-3.5 w-3.5" /> Back to DTR
            </Button>
          </Link>
        </div>
      </div>
      </div>

      <div className="p-6">
        <div className="border border-border/60 bg-background">
          <div className="p-6">
            {!syncResult && !isProcessing ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div
                  className={cn(
                    "rounded-xl border-2 border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center transition-all duration-500 min-h-[400px]",
                    selectedFile ? "lg:col-span-5 py-10" : "lg:col-span-12 py-24"
                  )}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    accept=".txt"
                    onChange={handleFileChange}
                  />

                  {!selectedFile ? (
                    <>
                      <IconUpload className="h-16 w-16 text-muted-foreground/20 mb-6" />
                      <div className="text-center space-y-2 mb-10">
                        <h3 className="text-base font-medium text-foreground/80">
                          Upload Attendance File
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-[320px]">
                          Browse for your biometric device export file (.txt format)
                        </p>
                      </div>
                      <Button onClick={() => fileInputRef.current?.click()}>
                        Select File
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-6 w-full px-8">
                      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
                        <div className="p-3 rounded-md bg-primary text-primary-foreground shadow-sm">
                          <IconFileText className="h-8 w-8" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(2)} KB - text file
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Button
                          onClick={handleSync}
                          disabled={loading}
                          className="w-full gap-2"
                        >
                          {loading ? <IconLoader2 className="h-5 w-5 animate-spin" /> : <IconUpload className="h-5 w-5" />}
                          Import Attendance Data
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedFile(null)
                            setFilePreview(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                          className="w-full"
                        >
                          <IconX className="h-3 w-3 mr-2" /> Remove File
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {selectedFile ? (
                  <div className="lg:col-span-7 space-y-4 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <h3 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                        <IconFileText className="h-3 w-3" /> File Preview
                      </h3>
                      <Badge variant="outline" className="text-[11px] border-border/60">
                        First 100 Lines
                      </Badge>
                    </div>
                    <div className="p-0 rounded-md border border-border/60 bg-muted/20 h-[400px] relative">
                      <ScrollArea className="h-full w-full">
                        <div className="p-4 text-[11px] leading-relaxed text-muted-foreground whitespace-pre">
                          {filePreview || "Reading data..."}
                          <div className="h-4 w-2 bg-primary inline-block animate-pulse ml-1 align-middle" />
                        </div>
                        <ScrollBar orientation="vertical" />
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-md border border-border/60 bg-muted/10 space-y-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 animate-pulse" />

                <div className="relative">
                  <div className="h-32 w-32 border-4 border-primary/20 flex items-center justify-center animate-[spin_4s_linear_infinite]">
                    <div className="h-24 w-24 border-4 border-primary/40 flex items-center justify-center animate-[spin_2s_linear_infinite_reverse]">
                      <div className="h-16 w-16 border-4 border-primary bg-background/70" />
                    </div>
                  </div>
                  <IconScan className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>

                <div className="text-center space-y-4 z-10">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    Processing Import
                  </h3>
                  <div className="w-full max-w-[560px] space-y-3 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Streaming Progress</span>
                        <span className="tabular-nums text-foreground/80">{Math.round(syncProgress)}%</span>
                      </div>
                      <Progress value={syncProgress} className="h-2 rounded-none bg-primary/15" />
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      Live sync progress will continue until all attendance records are imported.
                    </p>
                  </div>
                  <div className="h-40 w-full max-w-[560px] bg-background/80 border border-border/60 p-4 text-[11px] text-muted-foreground overflow-hidden rounded-md">
                    <div className="space-y-1">
                      {processLogs.map((log, index) => (
                        <div key={`${log}-${String(index)}`} className="flex gap-2 animate-in slide-in-from-left-2 duration-300">
                          <span className="text-primary">&gt;&gt;</span>
                          <span className="text-foreground/80">{log}</span>
                        </div>
                      ))}
                      <div className="h-3 w-1.5 bg-primary animate-pulse inline-block ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-primary/20 divide-y md:divide-y-0 md:divide-x divide-border/60">
                  <div className="p-8 bg-emerald-500/[0.03]">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Import Status</p>
                    <div className="flex items-center gap-2 mt-2">
                      <IconCheck className="h-5 w-5 text-primary" />
                      <span className="text-xl text-foreground">Complete</span>
                    </div>
                  </div>
                  <div className="p-8 bg-muted/5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">DTR Records Updated</p>
                    <p className="text-3xl mt-1 tabular-nums">{syncResult?.processedCount}</p>
                  </div>
                </div>

                <div className="p-8 bg-primary/[0.03] border border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <IconShieldCheck className="h-6 w-6 text-primary" />
                    <p className="text-foreground text-sm">Attendance Records Successfully Imported</p>
                  </div>
                  <div className="flex gap-4">
                    <Button onClick={resetState} variant="outline" className="gap-2">
                      Import Another File
                    </Button>
                    <Link href={`/${companyId}/attendance/dtr`}>
                      <Button className="gap-2">
                        View Time Records
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-muted/30 border-t border-border/60 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Data Integrity Notice</p>
            <p className="text-sm text-muted-foreground italic">
              Imported attendance records will update existing Daily Time Records (DTR) for matched employees. Ensure
              the import file covers the complete attendance period.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
