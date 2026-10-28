"use server"

import { auth } from "@clerk/nextjs/server"
import { daytona } from "@/lib/daytona"

export interface SandboxVncUrlResult {
  url?: string
  acceptUrl?: string
  error?: string
}

export async function getSandboxVncUrl(sandboxId: string): Promise<SandboxVncUrlResult> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { error: "Unauthorized. Please sign in to access the sandbox." }
    }

    if (!sandboxId) {
      return { error: "No sandboxId provided for this bot." }
    }

    let timer: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "Connection timed out while contacting Daytona sandbox. It may still be initializing."
            )
          ),
        15000
      )
    })

    const connectPromise = (async (): Promise<SandboxVncUrlResult> => {
      try {
        const sandbox = await daytona.get(sandboxId)
        if (!sandbox) {
          return { error: `Sandbox ${sandboxId} was not found on Daytona.` }
        }

        // Ensure sandbox is started
        if (sandbox.state && sandbox.state !== "started") {
          try {
            await sandbox.start()
          } catch (startErr: unknown) {
            console.warn(`Could not start sandbox ${sandboxId}:`, startErr)
          }
        }

        // Ensure computerUse stack (Xvfb, xfce4, x11vnc, novnc) is running
        try {
          const novncStatus = await sandbox.computerUse.getProcessStatus("novnc")
          if (!novncStatus?.running) {
            await sandbox.computerUse.start()
          }
        } catch {
          try {
            await sandbox.computerUse.start()
          } catch (cuError: unknown) {
            console.warn(`Could not start computerUse for sandbox ${sandboxId}:`, cuError)
          }
        }

        // Get signed preview URL for noVNC on port 6080, valid for 2 hours (7200s)
        const signed = await sandbox.getSignedPreviewUrl(6080, 7200)
        if (!signed || !signed.url) {
          return { error: "Could not retrieve preview URL from sandbox." }
        }

        // Append auto-connect and scale parameters so noVNC immediately connects and fits
        const baseUrl = signed.url.replace(/\/+$/, "")
        const targetUrl = `${baseUrl}/vnc.html?autoconnect=true&resize=scale&reconnect=true`

        // Daytona warning bypass endpoint: submitting a POST sets the accepted cookie and redirects
        const acceptUrl = `${baseUrl}/accept-daytona-preview-warning?redirect=${encodeURIComponent(targetUrl)}`

        return {
          url: targetUrl,
          acceptUrl,
        }
      } finally {
        if (timer) clearTimeout(timer)
      }
    })()

    return await Promise.race([connectPromise, timeoutPromise])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect to sandbox VNC."
    console.error(`Failed to get sandbox VNC URL for ${sandboxId}:`, error)
    return { error: message }
  }
}
