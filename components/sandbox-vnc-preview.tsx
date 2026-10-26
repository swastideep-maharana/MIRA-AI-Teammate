"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { RotateCw, Maximize2, X, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getSandboxVncUrl } from "@/actions/sandbox"

interface SandboxVncPreviewProps {
  sandboxId?: string | null
  botName?: string | null
}

export function SandboxVncPreview({
  sandboxId,
  botName,
}: SandboxVncPreviewProps) {
  const [vncUrl, setVncUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [iframeKey, setIframeKey] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

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
        const result = await getSandboxVncUrl(sandboxId)
        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setVncUrl(result.url)
          if (refresh) {
            setIframeKey((prev) => prev + 1)
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to connect to sandbox VNC.")
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

  // Prevent dialog from being closed by any hotkeys or outside clicks
  const handleOpenChange = useCallback((open: boolean, eventDetails?: any) => {
    if (!open) {
      if (
        eventDetails?.reason === "close-press" ||
        eventDetails?.reason === "imperative-action"
      ) {
        setIsFullscreen(false)
      }
      return
    }
    setIsFullscreen(open)
  }, [])

  const screenTitle = botName ? `${botName}'s screen` : "Sandbox screen"

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden bg-background select-none">
      {/* Top action bar with Refresh icon button */}
      <div className="flex items-center justify-end px-4 pt-3 pb-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fetchVncUrl(true)}
          disabled={isLoading || isRefreshing || !sandboxId}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Refresh VNC session"
        >
          <RotateCw
            className={cn("w-4 h-4", isRefreshing && "animate-spin")}
          />
          <span className="sr-only">Refresh preview</span>
        </Button>
      </div>

      {/* Main preview container aligned at top */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-2 pb-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Starting VNC stream...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 max-w-xs text-center">
            <AlertCircle className="w-8 h-8 text-destructive/80" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchVncUrl(true)}
              className="mt-2 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : vncUrl ? (
          <div className="flex flex-col items-center gap-3 w-full">
            {/* The preview box */}
            <div
              ref={containerRef}
              className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-zinc-800/80 bg-black shadow-md"
            >
              {/* Single persistent VNC iframe container */}
              <div
                className={cn(
                  isFullscreen
                    ? "fixed inset-3 sm:inset-6 top-[57px] z-[60] rounded-b-xl overflow-hidden bg-black shadow-2xl flex flex-col"
                    : "absolute inset-0 w-full h-full"
                )}
                onKeyDown={(e) => {
                  // Prevent hotkeys inside VNC from bubbling out and closing modal
                  e.stopPropagation()
                }}
              >
                <iframe
                  key={iframeKey}
                  src={vncUrl}
                  title={screenTitle}
                  className="w-full h-full border-0 bg-black"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              </div>

              {/* Click overlay for preview mode: clicking opens fullscreen */}
              {!isFullscreen && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsFullscreen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setIsFullscreen(true)
                    }
                  }}
                  className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all group"
                  title="Click to view fullscreen"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs font-medium flex items-center gap-1.5 shadow-xl">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Open in fullscreen</span>
                  </div>
                </div>
              )}
            </div>

            {/* Screen caption below preview */}
            <span className="text-xs text-muted-foreground/80 font-medium">
              {screenTitle}
            </span>
          </div>
        ) : null}
      </div>

      {/* Fullscreen Dialog using @components/ui/dialog.tsx */}
      <Dialog
        open={isFullscreen}
        onOpenChange={handleOpenChange}
        disablePointerDismissal={true}
      >
        <DialogContent
          className="fixed inset-3 sm:inset-6 z-50 flex flex-col p-0 max-w-none w-auto h-auto bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl gap-0"
          showCloseButton={false}
          onKeyDown={(e) => {
            // Stop keyboard events from propagating to dialog close handler
            e.stopPropagation()
          }}
        >
          {/* Dialog Header */}
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60 space-y-0 h-[48px] select-none">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <DialogTitle className="text-sm font-medium text-zinc-200">
                {screenTitle}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Interactive fullscreen VNC session for {screenTitle}
            </DialogDescription>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen"
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Dialog Body (where the persistent iframe positions itself) */}
          <div className="flex-1 w-full h-full bg-black relative" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
