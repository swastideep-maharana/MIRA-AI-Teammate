"use server"

import { auth } from "@clerk/nextjs/server"
import { daytona } from "@/lib/daytona"

export interface SandboxVncUrlResult {
  url?: string
  error?: string
}

export async function getSandboxVncUrl(sandboxId: string): Promise<SandboxVncUrlResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return { error: "Unauthorized" }
  }

  if (!sandboxId) {
    return { error: "No sandboxId provided" }
  }

  try {
    const sandbox = await daytona.get(sandboxId)

    // Ensure sandbox is started
    if (sandbox.state !== "started") {
      await sandbox.start()
    }

    // Ensure computerUse stack (Xvfb, xfce4, x11vnc, novnc) is running
    try {
      const novncStatus = await sandbox.computerUse.getProcessStatus("novnc")
      if (!novncStatus?.running) {
        await sandbox.computerUse.start()
      }
    } catch {
      await sandbox.computerUse.start()
    }

    // Get signed preview URL for noVNC on port 6080, valid for 2 hours (7200s)
    const signed = await sandbox.getSignedPreviewUrl(6080, 7200)

    // Append auto-connect and scale parameters so noVNC immediately connects and fits
    const fullUrl = `${signed.url}/vnc.html?autoconnect=true&resize=scale&reconnect=true`

    return { url: fullUrl }
  } catch (error: any) {
    console.error(`Failed to get sandbox VNC URL for ${sandboxId}:`, error)
    return { error: error?.message || "Failed to get sandbox VNC URL" }
  }
}
