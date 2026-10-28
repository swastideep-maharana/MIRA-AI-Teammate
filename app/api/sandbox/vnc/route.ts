import { auth } from "@clerk/nextjs/server"
import { daytona } from "@/lib/daytona"

export const maxDuration = 60

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: "Unauthorized. Please sign in." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sandboxId = searchParams.get("sandboxId")

    if (!sandboxId) {
      return Response.json({ error: "Missing sandboxId parameter." }, { status: 400 })
    }

    if (!process.env.DAYTONA_API_KEY) {
      return Response.json(
        { error: "DAYTONA_API_KEY is not configured in server environment." },
        { status: 500 }
      )
    }

    const sandbox = await daytona.get(sandboxId)
    if (!sandbox) {
      return Response.json(
        { error: `Sandbox ${sandboxId} was not found on Daytona.` },
        { status: 404 }
      )
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
      return Response.json(
        { error: "Could not retrieve preview URL from sandbox." },
        { status: 502 }
      )
    }

    // Append auto-connect and scale parameters so noVNC immediately connects and fits
    const baseUrl = signed.url.replace(/\/+$/, "")
    const targetUrl = `${baseUrl}/vnc.html?autoconnect=true&resize=scale&reconnect=true`

    // Daytona warning bypass endpoint: submitting a POST sets the accepted cookie and redirects
    const acceptUrl = `${baseUrl}/accept-daytona-preview-warning?redirect=${encodeURIComponent(targetUrl)}`

    return Response.json({
      url: targetUrl,
      acceptUrl,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect to sandbox VNC."
    console.error("Error in /api/sandbox/vnc:", error)
    return Response.json({ error: message }, { status: 500 })
  }
}

