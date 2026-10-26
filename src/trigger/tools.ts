import { tool } from "ai"
import { z } from "zod"
import { getDaytona } from "../../lib/daytona"

export interface DaytonaToolContext {
  sandboxId?: string
}

export function createDaytonaTools(context?: DaytonaToolContext) {
  const getSandbox = async () => {
    const sandboxId = context?.sandboxId
    if (!sandboxId) {
      throw new Error(
        "No sandbox environment attached to this bot. Sandbox ID is missing."
      )
    }
    const daytona = getDaytona()
    const sandbox = await daytona.get(sandboxId)
    if (!sandbox) {
      throw new Error(`Daytona sandbox with ID ${sandboxId} not found.`)
    }
    if (sandbox.state && sandbox.state !== "started") {
      try {
        await sandbox.start()
      } catch {
        // ignore if already starting or running
      }
    }
    return sandbox
  }

  const ensureComputerUse = async (sandbox: any) => {
    try {
      const status = await sandbox.computerUse.getStatus()
      if (status?.status !== "running") {
        await sandbox.computerUse.start()
      }
    } catch {
      try {
        await sandbox.computerUse.start()
      } catch {
        // ignore if already started
      }
    }
  }

  return {
    bash: tool({
      description:
        "Run a bash or shell command in the sandbox terminal. Returns standard output and exit code.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
      execute: async ({ command }) => {
        try {
          const sandbox = await getSandbox()
          const res = await sandbox.process.executeCommand(command)
          return {
            stdout: res.result,
            exitCode: res.exitCode,
          }
        } catch (error: any) {
          return {
            error: error?.message || String(error),
            exitCode: -1,
          }
        }
      },
    }),

    readFile: tool({
      description:
        "Read the contents of a file at the specified path in the sandbox filesystem.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ path }) => {
        try {
          const sandbox = await getSandbox()
          const buffer = await sandbox.fs.downloadFile(path)
          return {
            path,
            content: buffer.toString("utf-8"),
          }
        } catch (error: any) {
          return {
            path,
            error: error?.message || String(error),
          }
        }
      },
    }),

    writeFile: tool({
      description:
        "Write or overwrite content to a file at the specified path in the sandbox filesystem.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file to write"),
        content: z.string().describe("The text content to write into the file"),
      }),
      execute: async ({ path, content }) => {
        try {
          const sandbox = await getSandbox()
          await sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), path)
          return {
            path,
            success: true,
            bytesWritten: Buffer.byteLength(content, "utf-8"),
          }
        } catch (error: any) {
          return {
            path,
            success: false,
            error: error?.message || String(error),
          }
        }
      },
    }),

    listFiles: tool({
      description:
        "List files and directories at the specified path in the sandbox filesystem.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .default(".")
          .describe(
            "Directory path to list (defaults to current working directory)"
          ),
      }),
      execute: async ({ path = "." }) => {
        try {
          const sandbox = await getSandbox()
          const files = await sandbox.fs.listFiles(path)
          return {
            path,
            files: files.map((f) => ({
              name: f.name,
              isDir: f.isDir,
              size: f.size,
              modTime: f.modTime,
            })),
          }
        } catch (error: any) {
          return {
            path,
            error: error?.message || String(error),
            files: [],
          }
        }
      },
    }),

    mouseClick: tool({
      description:
        "Click the mouse at specified coordinates on the desktop display.",
      inputSchema: z.object({
        x: z.number().describe("The X coordinate to click at"),
        y: z.number().describe("The Y coordinate to click at"),
        button: z
          .enum(["left", "right", "middle"])
          .optional()
          .default("left")
          .describe("Mouse button to click (left, right, middle)"),
        double: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to perform a double click"),
      }),
      execute: async ({ x, y, button = "left", double = false }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await sandbox.computerUse.mouse.click(x, y, button, double)
          return {
            success: true,
            x,
            y,
            button,
            double,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
    }),

    mouseMove: tool({
      description:
        "Move the mouse cursor to specified coordinates on the desktop display.",
      inputSchema: z.object({
        x: z.number().describe("The X coordinate to move to"),
        y: z.number().describe("The Y coordinate to move to"),
      }),
      execute: async ({ x, y }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          const res = await sandbox.computerUse.mouse.move(x, y)
          return {
            success: true,
            x: res.x,
            y: res.y,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
    }),

    mouseScroll: tool({
      description:
        "Scroll the mouse wheel at specified coordinates on the desktop display.",
      inputSchema: z.object({
        x: z.number().describe("The X coordinate to scroll at"),
        y: z.number().describe("The Y coordinate to scroll at"),
        direction: z
          .enum(["up", "down"])
          .describe("Scroll direction ('up' or 'down')"),
        amount: z
          .number()
          .optional()
          .default(1)
          .describe("Number of scroll clicks/steps"),
      }),
      execute: async ({ x, y, direction, amount = 1 }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await sandbox.computerUse.mouse.scroll(x, y, direction, amount)
          return {
            success: true,
            x,
            y,
            direction,
            amount,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
    }),

    keyboardType: tool({
      description:
        "Type text using the keyboard in the active window on the desktop display.",
      inputSchema: z.object({
        text: z.string().describe("The text string to type"),
        delay: z
          .number()
          .optional()
          .describe("Optional delay between keystrokes in milliseconds"),
      }),
      execute: async ({ text, delay }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await sandbox.computerUse.keyboard.type(text, delay)
          return {
            success: true,
            charactersTyped: text.length,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
    }),

    keyboardPress: tool({
      description:
        "Press a specific keyboard key or key combination (e.g. 'enter', 'tab', 'escape', 'c' with ['ctrl'], 'alt+tab').",
      inputSchema: z.object({
        key: z
          .string()
          .describe(
            "Key name to press (e.g., 'enter', 'tab', 'escape', 'c', or hotkey combo like 'ctrl+c')"
          ),
        modifiers: z
          .array(z.string())
          .optional()
          .describe("List of modifier keys (e.g., ['ctrl', 'shift', 'alt'])"),
      }),
      execute: async ({ key, modifiers }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          if (key.includes("+") && (!modifiers || modifiers.length === 0)) {
            await sandbox.computerUse.keyboard.hotkey(key)
          } else {
            await sandbox.computerUse.keyboard.press(key, modifiers)
          }
          return {
            success: true,
            key,
            modifiers: modifiers || [],
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
    }),

    viewScreen: tool({
      description:
        "Capture and view the current desktop screen in the sandbox so you can inspect what is visible on display. Use this to examine applications, check outputs, or decide your next UI action. This screenshot is for your internal inspection and is NEVER rendered in chat.",
      inputSchema: z.object({
        showCursor: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Whether to include the mouse cursor in the captured screenshot"
          ),
      }),
      execute: async ({ showCursor = false }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          const res =
            await sandbox.computerUse.screenshot.takeFullScreen(showCursor)
          return {
            success: true,
            screenshot: res.screenshot,
            sizeBytes: res.sizeBytes,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (output?.screenshot) {
          return {
            type: "content",
            value: [
              {
                type: "file",
                mediaType: "image/png",
                data: { type: "data", data: output.screenshot },
              },
              {
                type: "text",
                text: "Desktop screen screenshot captured. Inspect the screenshot image to see the active display and continue your task.",
              },
            ],
          }
        }
        return {
          type: "text",
          value: output?.error
            ? `Failed to view screen: ${output.error}`
            : "Failed to capture screen",
        }
      },
    }),

    showScreen: tool({
      description:
        "Capture the current desktop screen and display it directly to the user in chat. Call this when the user asks what is on the screen, wants a screenshot, or requests to see what is currently open.",
      inputSchema: z.object({
        showCursor: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Whether to include the mouse cursor in the screenshot. Defaults to true."
          ),
      }),
      execute: async ({ showCursor = true }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          const res =
            await sandbox.computerUse.screenshot.takeFullScreen(showCursor)
          return {
            success: true,
            screenshot: res.screenshot,
            sizeBytes: res.sizeBytes,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || String(error),
          }
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        return {
          type: "text",
          value: output?.success
            ? "Screenshot captured and rendered in chat for the user."
            : `Failed to show screen: ${output?.error}`,
        }
      },
    }),
  }
}

export type DaytonaTools = ReturnType<typeof createDaytonaTools>
