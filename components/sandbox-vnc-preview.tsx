"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  RotateCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
  AlertCircle,
  Loader2,
  MousePointer,
  MousePointerClick,
  Monitor,
  Cpu,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Activity,
  PanelRightClose,
  Ratio,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog"

interface SandboxVncPreviewProps {
  sandboxId?: string | null
  botName?: string | null
  className?: string
  onClose?: () => void
}

type ScaleMode = "fit" | "16:10" | "fill"

export function SandboxVncPreview({
  sandboxId,
  botName,
  className,
  onClose,
}: SandboxVncPreviewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [vncUrl, setVncUrl] = useState<string | null>(null)
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [iframeKey, setIframeKey] = useState<number>(0)
  const [isInteractive, setIsInteractive] = useState<boolean>(true)
  const [scaleMode, setScaleMode] = useState<ScaleMode>("16:10")
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const copySandboxId = useCallback(() => {
    if (!sandboxId) return
    navigator.clipboard.writeText(sandboxId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [sandboxId])

  const handleCollapse = useCallback(() => {
    if (onClose) {
      onClose()
      return
    }
    const next = new URLSearchParams(searchParams?.toString() || "")
    next.delete("desktop")
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [onClose, pathname, router, searchParams])

  const fetchVncUrl = useCallback(
    async (refresh = false) => {
      if (!sandboxId) {
        setError("No sandbox configured for this bot.")
        setIsLoading(false)
        return
      }

      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      try {
        const res = await fetch(
          `/api/sandbox/vnc?sandboxId=${encodeURIComponent(sandboxId)}`
        )
        const result = await res.json()
        if (!res.ok || result.error) {
          setError(result.error || "Failed to connect to sandbox.")
        } else if (result.url) {
          setVncUrl(result.url)
          setAcceptUrl(result.acceptUrl || null)
          if (refresh) {
            setIframeKey((prev) => prev + 1)
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err || "")
        setError(msg || "Failed to connect to sandbox VNC.")
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [sandboxId]
  )

  useEffect(() => {
    fetchVncUrl()
  }, [fetchVncUrl])

  // Automatically submit bypass form when acceptUrl is ready so Daytona preview warning is skipped
  useEffect(() => {
    if (acceptUrl && formRef.current) {
      try {
        formRef.current.submit()
      } catch (e) {
        console.warn("Failed to auto-submit bypass form:", e)
      }
    }
  }, [acceptUrl, iframeKey])

  // Ensure that whenever isFullscreen is false, no stuck blurry dialog backdrops remain in the DOM
  useEffect(() => {
    if (!isFullscreen) {
      const strayOverlays = document.querySelectorAll(
        '[data-slot="dialog-overlay"]'
      )
      strayOverlays.forEach((el) => el.remove())
    }
  }, [isFullscreen])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIsFullscreen(false)
    }
  }, [])

  const cycleScaleMode = () => {
    setScaleMode((current) => {
      if (current === "16:10") return "fit"
      if (current === "fit") return "fill"
      return "16:10"
    })
  }

  const screenTitle = botName ? `${botName}'s desktop` : "Sandbox desktop"

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full min-h-0 overflow-hidden bg-background text-foreground select-none border-l border-border",
        className
      )}
    >
      {/* Sleek Daytona Control Bar */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 px-3 sm:px-4 bg-card/80 backdrop-blur-md border-b border-border z-10 transition-colors">
        {/* Left: Connection Status Indicator */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isLoading || isRefreshing ? (
              <span className="size-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            ) : error ? (
              <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            ) : (
              <span className="relative flex size-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500 shadow-xs ring-1 ring-emerald-500/50" />
              </span>
            )}
            <span className="text-xs font-semibold text-foreground truncate">
              {isLoading
                ? "Booting..."
                : error
                ? "Disconnected"
                : "Live Desktop"}
            </span>
          </div>
          {botName && (
            <span className="text-[11px] text-muted-foreground hidden 2xl:inline-block font-mono truncate max-w-[120px]">
              @{botName}
            </span>
          )}
        </div>

        {/* Right: Interactive Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Take Control Toggle */}
          {vncUrl && (
            <Button
              variant={isInteractive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsInteractive((prev) => !prev)}
              className={cn(
                "h-8 gap-1.5 px-2 text-xs font-medium transition-all cursor-pointer",
                isInteractive
                  ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              aria-label={isInteractive ? "Relinquish Control" : "Take Control"}
              title={
                isInteractive
                  ? "VM Mouse & Keyboard active (Click to pause control)"
                  : "Preview Mode (Click to take control of VM)"
              }
            >
              {isInteractive ? (
                <>
                  <MousePointerClick className="size-3.5 text-cyan-500 shrink-0" />
                  <span className="hidden xl:inline text-xs">In Control</span>
                </>
              ) : (
                <>
                  <MousePointer className="size-3.5 shrink-0" />
                  <span className="hidden xl:inline text-xs">Take Control</span>
                </>
              )}
            </Button>
          )}

          {/* Scale Mode Toggle */}
          {vncUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={cycleScaleMode}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer font-mono text-[11px]"
              aria-label={`Scale mode: ${scaleMode}`}
              title={`Resolution scale: ${scaleMode.toUpperCase()} (Click to toggle)`}
            >
              <Ratio className="size-3.5 text-cyan-500" />
              <span className="sr-only">Toggle resolution scale</span>
            </Button>
          )}

          {/* Refresh VNC Session */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fetchVncUrl(true)}
            disabled={isLoading || isRefreshing || !sandboxId}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Refresh VNC preview"
            title="Refresh VNC stream"
          >
            <RotateCw
              className={cn("size-3.5", isRefreshing && "animate-spin text-cyan-500")}
            />
          </Button>

          {/* External Tab */}
          {vncUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                window.open(vncUrl, "_blank", "noopener,noreferrer")
              }
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Open in new window"
              title="Open Daytona VNC in new window"
            >
              <ExternalLink className="size-3.5" />
            </Button>
          )}

          {/* Fullscreen Button */}
          {vncUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsFullscreen(true)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Open fullscreen"
              title="Expand edge-to-edge modal"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          )}

          {/* Collapse Live Desktop Panel Button */}
          <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCollapse}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            aria-label="Collapse live desktop panel"
            title="Collapse desktop preview"
          >
            <PanelRightClose className="size-3.5" />
            <span className="sr-only">Collapse desktop preview</span>
          </Button>
        </div>
      </div>

      {/* Main Desktop Canvas Area */}
      <div className={cn(
        "flex-1 flex flex-col p-3 sm:p-4 gap-3 min-h-0 relative",
        isLoading || error
          ? "items-center justify-center overflow-hidden"
          : "justify-start items-center overflow-y-auto overflow-x-hidden"
      )}>
        {isLoading ? (
          /* Developer-Tool Provisioning Skeleton */
          <div className="flex flex-col items-center justify-center gap-5 max-w-sm text-center px-4 py-12 rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-2xl">
            <div className="relative flex items-center justify-center size-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <Cpu className="size-7 animate-pulse text-cyan-500" />
              <span className="absolute -top-1 -right-1 size-3 rounded-full bg-cyan-500 animate-ping" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-semibold text-sm text-foreground">
                Provisioning Daytona Cloud Sandbox
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Booting Ubuntu desktop environment and noVNC streaming server...
              </p>
            </div>

            <div className="w-full space-y-2 text-left font-mono text-[11px] bg-muted/40 p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Isolated container ready</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-300">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-cyan-500" />
                <span>Starting X11 virtual display</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <Terminal className="size-3.5 shrink-0" />
                <span>Bridging port 6080 WebSocket</span>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3.5 p-6 max-w-xs text-center rounded-2xl border border-destructive/30 bg-destructive/5 shadow-lg">
            <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="size-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">
                Desktop Unavailable
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchVncUrl(true)}
              className="mt-1 text-xs gap-1.5 border-border hover:bg-muted cursor-pointer font-mono"
            >
              <RotateCw className="size-3.5" />
              Retry Connection
            </Button>
          </div>
        ) : vncUrl ? (
          <div className="flex flex-col gap-3 w-full shrink-0">
            {/* The VNC Box */}
            <div
              ref={containerRef}
              className={cn(
                "relative w-full aspect-[16/10] shrink-0 rounded-xl overflow-hidden border border-border bg-black shadow-lg flex items-center justify-center transition-all",
                scaleMode === "fill" && "aspect-auto h-[480px]"
              )}
            >
              {/* VNC iframe container */}
              <div
                className={cn(
                  isFullscreen
                    ? "fixed inset-2 sm:inset-6 z-[60] rounded-2xl overflow-hidden bg-background border border-border shadow-2xl flex flex-col"
                    : "absolute inset-0 w-full h-full flex flex-col"
                )}
                onKeyDown={(e) => {
                  e.stopPropagation()
                }}
              >
                {/* Fullscreen header */}
                {isFullscreen && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0 select-none">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-xs ring-1 ring-emerald-500/50" />
                      <span className="text-sm font-semibold text-foreground">
                        {screenTitle}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                        Full Control
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer shadow-xs"
                        onClick={() => setIsFullscreen(false)}
                        title="Minimize to panel"
                      >
                        <Minimize2 className="size-3.5" />
                        <span>Minimize</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                        onClick={() => setIsFullscreen(false)}
                        title="Close fullscreen"
                        aria-label="Close fullscreen"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* VNC Screen Frame */}
                <div className="flex-1 w-full h-full min-h-0 bg-black relative">
                  {acceptUrl && (
                    <form
                      ref={formRef}
                      action={acceptUrl}
                      method="POST"
                      target="daytona-vnc-frame"
                      className="hidden"
                    >
                      <input type="hidden" name="accept" value="true" />
                    </form>
                  )}
                  <iframe
                    name="daytona-vnc-frame"
                    key={iframeKey}
                    src={acceptUrl ? undefined : (vncUrl || undefined)}
                    title={screenTitle}
                    className={cn(
                      "w-full h-full border-0 bg-black",
                      !isInteractive && "pointer-events-none"
                    )}
                    allow="clipboard-read; clipboard-write; fullscreen"
                  />

                  {/* Non-interactive overlay to prevent cursor capture while scrolling */}
                  {!isInteractive && !isFullscreen && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsInteractive(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setIsInteractive(true)
                        }
                      }}
                      className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-black/40 hover:bg-black/20 backdrop-blur-[1px] transition-all group"
                      title="Click to take control of keyboard and mouse"
                    >
                      <div className="bg-card/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border text-foreground text-xs font-medium flex items-center gap-2 shadow-2xl group-hover:scale-105 transition-transform">
                        <MousePointerClick className="size-4 text-cyan-500" />
                        <span>Click to Take Control</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom metadata footer bar */}
            <div className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-muted-foreground border border-border/50 bg-card/60 rounded-lg shadow-2xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex size-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
                </span>
                <span className="truncate font-medium text-[11px] text-foreground">{screenTitle}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
                  {scaleMode === "16:10" ? "1280×800 (16:10)" : scaleMode.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Professional Daytona Sandbox Workspace Telemetry Card */}
            <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2.5 w-full shrink-0 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="size-3.5 text-cyan-500" />
                  Runtime Diagnostics
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Active
                </span>
              </div>

              <div className="space-y-1.5 text-xs divide-y divide-border/30">
                <div className="flex items-center justify-between pt-1 first:pt-0">
                  <span className="text-[11px] text-muted-foreground font-mono">OS / Display</span>
                  <span className="font-medium text-foreground text-xs">Ubuntu 24.04 (X11)</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground font-mono">Protocol</span>
                  <span className="font-medium text-foreground text-xs">noVNC Port 6080</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground font-mono">Input Mode</span>
                  <span className="font-medium text-foreground text-xs">
                    {isInteractive ? "Direct (Mouse/Kbd)" : "Passive Preview"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground font-mono">Resolution</span>
                  <span className="font-medium text-foreground text-xs">1280 × 800 (16:10)</span>
                </div>
              </div>

              {sandboxId && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/40 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Terminal className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{sandboxId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copySandboxId}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0 font-sans"
                  >
                    {isCopied ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Fullscreen Backdrop Portal */}
      {isFullscreen && (
        <Dialog
          open={isFullscreen}
          onOpenChange={handleOpenChange}
          disablePointerDismissal={true}
        >
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm" />
          </DialogPortal>
        </Dialog>
      )}
    </div>
  )
}
export default SandboxVncPreview
