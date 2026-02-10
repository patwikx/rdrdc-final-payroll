"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconCheck,
  IconFileText,
  IconLoader2,
  IconRefresh,
  IconShieldCheck,
  IconScan,
  IconUpload,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { syncBiometricsAction } from "@/modules/attendance/sync/actions/sync-biometrics-action"

type SyncBiometricsPageProps = {
  companyName: string
  companyId: string
}

export function SyncBiometricsPage({ companyName, companyId }: SyncBiometricsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ processedCount: number } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [processLogs, setProcessLogs] = useState<string[]>([])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".txt")) {
      toast.error("Please upload a valid .txt file")
      event.target.value = ""
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      const content = String(readerEvent.target?.result ?? "")
      const lines = content.split(/\r?\n/).slice(0, 100).join("\n")
      setFilePreview(lines)
    }
    reader.readAsText(file)
  }

  const handleSync = async () => {
    if (!selectedFile) return

    try {
      setLoading(true)
      setIsProcessing(true)
      setProcessLogs(["INITIALIZING IMPORT...", "READING ATTENDANCE FILE..."])

      const fullContent = await selectedFile.text()

      const logSteps = [
        "PARSING TIME ENTRIES...",
        "MATCHING EMPLOYEE RECORDS...",
        "VALIDATING TIME DATA...",
        "UPDATING DTR RECORDS...",
      ]

      for (const log of logSteps) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        setProcessLogs((previous) => [...previous, log])
      }

      const response = await syncBiometricsAction({ companyId, fileContent: fullContent })

      if (response.ok) {
        setSyncResult({ processedCount: response.data.recordsProcessed })
        setIsProcessing(false)
        toast.success(`Synchronized ${response.data.recordsProcessed} attendance records`)
      } else {
        setIsProcessing(false)
        toast.error(response.error || "Failed to sync biometrics")
      }
    } catch {
      setIsProcessing(false)
      toast.error("A system error occurred during synchronization")
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setSelectedFile(null)
    setFilePreview(null)
    setSyncResult(null)
    setIsProcessing(false)
    setProcessLogs([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="w-full min-h-screen bg-background animate-in fade-in duration-500">
      <div className="px-6 py-6 border-b border-border/60 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-muted/20">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Human Resources</p>
          <div className="flex items-center gap-4">
            <h1 className="inline-flex items-center gap-2 text-2xl text-foreground"><IconScan className="size-6" /> Biometric Import</h1>
            <div className="px-2 py-0.5 rounded-md border border-primary/20 bg-primary/5 text-primary text-xs">
              {companyName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/${companyId}/attendance/dtr`}>
            <Button variant="outline" className="gap-2">
              <IconArrowLeft className="h-3.5 w-3.5" /> Back to DTR
            </Button>
          </Link>
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
                        <h3 className="text-lg text-foreground/80">
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
                          <p className="text-sm truncate text-foreground">{selectedFile.name}</p>
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
                      <h3 className="text-xs text-muted-foreground/80 flex items-center gap-2">
                        <IconFileText className="h-3 w-3" /> File Preview
                      </h3>
                      <Badge variant="outline" className="text-[11px] border-border/60">
                        First 100 Lines
                      </Badge>
                    </div>
                    <div className="bg-black p-0 rounded-md border border-zinc-800 shadow-lg h-[400px] relative">
                      <ScrollArea className="h-full w-full">
                        <div className="p-4 text-[11px] leading-relaxed text-zinc-400 whitespace-pre">
                          {filePreview || "Reading data..."}
                          <div className="h-4 w-2 bg-primary inline-block animate-pulse ml-1 align-middle" />
                        </div>
                        <ScrollBar orientation="vertical" className="bg-zinc-900/50" />
                        <ScrollBar orientation="horizontal" className="bg-zinc-900/50" />
                      </ScrollArea>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center justify-center py-16 bg-black rounded-md border border-zinc-800 space-y-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 animate-pulse" />

                <div className="relative">
                  <div className="h-32 w-32 border-4 border-primary/20 flex items-center justify-center animate-[spin_4s_linear_infinite]">
                    <div className="h-24 w-24 border-4 border-primary/40 flex items-center justify-center animate-[spin_2s_linear_infinite_reverse]">
                      <div className="h-16 w-16 border-4 border-primary bg-primary/10" />
                    </div>
                  </div>
                  <IconRefresh className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                </div>

                <div className="text-center space-y-4 z-10">
                  <h3 className="text-2xl text-primary animate-pulse">
                    Processing Import
                  </h3>
                  <div className="h-40 w-[400px] bg-zinc-900/50 border border-zinc-800 p-4 text-[11px] text-zinc-500 overflow-hidden rounded-md">
                    <div className="space-y-1">
                      {processLogs.map((log, index) => (
                        <div key={`${log}-${String(index)}`} className="flex gap-2 animate-in slide-in-from-left-2 duration-300">
                          <span className="text-primary/40">&gt;&gt;</span>
                          <span className="text-zinc-300">{log}</span>
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
                    <p className="text-xs text-muted-foreground">Import Status</p>
                    <div className="flex items-center gap-2 mt-2">
                      <IconCheck className="h-5 w-5 text-primary" />
                      <span className="text-xl text-foreground">Complete</span>
                    </div>
                  </div>
                  <div className="p-8 bg-muted/5">
                    <p className="text-xs text-muted-foreground">DTR Records Updated</p>
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
            <p className="text-xs text-primary">Data Integrity Notice</p>
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
