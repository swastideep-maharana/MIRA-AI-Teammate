"use server"

import { auth } from "@clerk/nextjs/server"
import { daytona } from "@/lib/daytona"

export interface SandboxVncUrlResult {
  url?: string
  acceptUrl?: string
  error?: string
}

// In-memory tracker for sandbox last activity (VNC connection or tool use)
const sandboxLastActivity = new Map<string, number>()
const HIBERNATION_IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

export async function recordSandboxActivity(sandboxId: string): Promise<void> {
  if (sandboxId) {
    sandboxLastActivity.set(sandboxId, Date.now())
  }
}

/**
 * Stop / hibernate a sandbox if no activity or VNC connections have been detected for 15+ minutes.
 * If force=true, stops the sandbox immediately (used for failure cleanup or session termination).
 */
export async function autoHibernateSandbox(
  sandboxId: string,
  force = false
): Promise<{ hibernated: boolean; reason?: string }> {
  try {
    if (!sandboxId) return { hibernated: false, reason: "No sandboxId provided" }

    const lastSeen = sandboxLastActivity.get(sandboxId) || 0
    const idleDuration = Date.now() - lastSeen

    if (!force && idleDuration < HIBERNATION_IDLE_TIMEOUT_MS) {
      return {
        hibernated: false,
        reason: `Sandbox was active ${Math.round(idleDuration / 1000)}s ago (idle limit is 15m)`,
      }
    }

    const sandbox = await daytona.get(sandboxId)
    if (!sandbox) return { hibernated: false, reason: "Sandbox not found" }

    if (sandbox.state === "started") {
      try {
        await sandbox.stop()
        sandboxLastActivity.delete(sandboxId)
        console.log(`[Lifecycle] Successfully hibernated idle sandbox ${sandboxId}`)
        return { hibernated: true }
      } catch (stopErr: any) {
        console.warn(`[Lifecycle] Failed to stop sandbox ${sandboxId}:`, stopErr)
        return { hibernated: false, reason: stopErr?.message || String(stopErr) }
      }
    }

    return { hibernated: false, reason: `Sandbox is already ${sandbox.state}` }
  } catch (error: any) {
    console.warn(`[Lifecycle] Error in autoHibernateSandbox for ${sandboxId}:`, error)
    return { hibernated: false, reason: error?.message || String(error) }
  }
}

/**
 * Wake-on-interaction fallback: if a user submits a prompt or connects to a hibernated bot,
 * starts the sandbox asynchronously and ensures computer-use display services are ready.
 */
export async function ensureSandboxActive(
  sandboxId: string
): Promise<{ ready: boolean; state?: string; error?: string }> {
  try {
    if (!sandboxId) return { ready: false, error: "No sandboxId provided" }

    recordSandboxActivity(sandboxId)
    const sandbox = await daytona.get(sandboxId)
    if (!sandbox) return { ready: false, error: "Sandbox not found" }

    if (sandbox.state && sandbox.state !== "started") {
      try {
        await sandbox.start()
        console.log(`[Lifecycle] Woke up hibernated sandbox ${sandboxId}`)
      } catch (startErr: any) {
        console.warn(`[Lifecycle] Could not start sandbox ${sandboxId}:`, startErr)
        return { ready: false, error: startErr?.message || String(startErr) }
      }
    }

    // Ensure computerUse stack is active
    try {
      const novncStatus = await sandbox.computerUse.getProcessStatus("novnc")
      if (!novncStatus?.running) {
        await sandbox.computerUse.start()
      }
    } catch {
      try {
        await sandbox.computerUse.start()
      } catch {}
    }

    return { ready: true, state: "started" }
  } catch (err: any) {
    return { ready: false, error: err?.message || String(err) }
  }
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

    recordSandboxActivity(sandboxId)

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
