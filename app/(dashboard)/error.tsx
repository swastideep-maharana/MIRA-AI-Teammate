"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("Dashboard error boundary caught:", error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full min-h-0 p-6 text-center select-none">
      <div className="flex flex-col items-center max-w-sm gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Could not load chat
          </h2>
          <p className="text-xs text-muted-foreground">
            {error?.message && !error.message.includes("Minified React error")
              ? error.message
              : "An unexpected error occurred while loading this chat."}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reset()}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              window.location.href = "/"
            }}
            className="text-xs cursor-pointer"
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
