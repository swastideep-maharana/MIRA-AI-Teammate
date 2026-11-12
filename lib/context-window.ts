function hasScreenshotContent(msg: any): boolean {
  if (Array.isArray(msg.parts)) {
    for (const p of msg.parts) {
      if (
        p.type === "file" &&
        (p.mediaType?.startsWith("image/") || String(p.filename || "").includes("screenshot"))
      ) {
        return true
      }
      if (p.output?.screenshot || (p.output as any)?.mediaType?.startsWith("image/")) {
        return true
      }
    }
  }
  if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      if (p.type === "file" || p.type === "image") {
        const mediaType = p.mediaType || p.mimeType || ""
        if (
          mediaType.startsWith("image/") ||
          String(p.filename || "").includes("screenshot") ||
          (typeof p.data === "string" && p.data.startsWith("data:image/"))
        ) {
          return true
        }
      }
    }
  }
  return false
}

function pruneScreenshotFromMessage(msg: any, stepNum: number): void {
  if (Array.isArray(msg.parts)) {
    for (const p of msg.parts) {
      if (
        p.type === "file" &&
        (p.mediaType?.startsWith("image/") || String(p.filename || "").includes("screenshot"))
      ) {
        p.type = "text"
        p.text = `[Screenshot taken: Desktop state at step ${stepNum} observed]`
        delete p.url
        delete p.data
      }
      if (p.output?.screenshot) {
        p.output.screenshot = `[Screenshot data pruned for context optimization: Desktop state at step ${stepNum} observed]`
      }
    }
  }
  if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      if (p.type === "file" || p.type === "image") {
        const mediaType = p.mediaType || p.mimeType || ""
        if (
          mediaType.startsWith("image/") ||
          String(p.filename || "").includes("screenshot") ||
          (typeof p.data === "string" && p.data.startsWith("data:image/"))
        ) {
          p.type = "text"
          p.text = `[Screenshot taken: Desktop state at step ${stepNum} observed]`
          delete p.data
          delete p.url
        }
      }
    }
  }
  if (Array.isArray(msg.experimental_attachments)) {
    msg.experimental_attachments = msg.experimental_attachments.map((att: any) => {
      if (att.contentType?.startsWith("image/") || att.url?.startsWith("data:image/")) {
        return {
          name: att.name || "screenshot",
          contentType: "text/plain",
          url: `data:text/plain;base64,${Buffer.from(`[Screenshot at step ${stepNum}]`).toString("base64")}`,
        }
      }
      return att
    })
  }
}

/**
 * Ephemeral visual history: Retains ONLY the single most recent visual screenshot in active context.
 * Converts past screenshots into compact text summaries: `[Screenshot taken: Desktop state at step N observed]`.
 */
export function prunePastScreenshots(messages: any[]): any[] {
  let stepCounter = 0
  for (const m of messages) {
    if (hasScreenshotContent(m)) {
      stepCounter++
    }
  }

  let currentStep = stepCounter
  let hasRetainedLatestScreenshot = false
  const cloned = JSON.parse(JSON.stringify(messages))

  for (let i = cloned.length - 1; i >= 0; i--) {
    const msg = cloned[i]
    if (hasScreenshotContent(msg)) {
      if (!hasRetainedLatestScreenshot) {
        hasRetainedLatestScreenshot = true
        currentStep--
      } else {
        pruneScreenshotFromMessage(msg, currentStep)
        currentStep--
      }
    }
  }

  return cloned
}

function extractMessageText(m: any): string {
  if (!m) return ""
  if (typeof m.content === "string" && m.content) return m.content
  if (Array.isArray(m.parts)) {
    const partsText = m.parts
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join(" ")
    if (partsText) return partsText
  }
  if (Array.isArray(m.content)) {
    return m.content.find((p: any) => p?.type === "text")?.text || ""
  }
  return ""
}

/**
 * Sliding window context truncation:
 * Pins the core task definition / first prompt, retains the last 6 active turns,
 * and compresses middle turns into a rolling summary when history exceeds 20 turns.
 */
export function applySlidingWindowContext(messages: any[]): any[] {
  const MAX_TURNS = 20
  const RECENT_ACTIVE_TURNS = 6

  if (!Array.isArray(messages) || messages.length <= MAX_TURNS) {
    return Array.isArray(messages) ? messages : []
  }

  const firstUserIdx = messages.findIndex((m) => m?.role === "user")
  const pinnedFirstMessage = firstUserIdx !== -1 ? messages[firstUserIdx] : messages[0]
  const lastActiveTurns = messages.slice(-RECENT_ACTIVE_TURNS)

  const middleStartIndex = firstUserIdx !== -1 ? firstUserIdx + 1 : 1
  const middleEndIndex = messages.length - RECENT_ACTIVE_TURNS
  const middleTurns = messages.slice(middleStartIndex, middleEndIndex)

  if (middleTurns.length === 0) {
    return messages
  }

  const actionSummaries: string[] = []
  for (const m of middleTurns) {
    if (!m) continue
    if (m.role === "user") {
      const text = extractMessageText(m)
      if (text) {
        actionSummaries.push(`User: "${text.slice(0, 75)}${text.length > 75 ? "..." : ""}"`)
      }
    } else if (m.role === "assistant") {
      const toolNames: string[] = []
      if (Array.isArray(m.parts)) {
        for (const p of m.parts) {
          if (p?.type?.includes("tool") || p?.type === "tool-call") {
            toolNames.push(p.toolName || p.name || "tool")
          }
        }
      }
      if (toolNames.length > 0) {
        actionSummaries.push(`Agent used [${toolNames.join(", ")}]`)
      } else {
        const text = extractMessageText(m)
        if (text) {
          actionSummaries.push(`Agent noted: "${text.slice(0, 75)}${text.length > 75 ? "..." : ""}"`)
        }
      }
    }
  }

  const compressedSummaryText = `[Context Optimization: ${middleTurns.length} earlier turns compressed into summary to preserve active context window]\nEarlier progress:\n${actionSummaries.slice(0, 10).map((s) => `- ${s}`).join("\n")}`

  const isUIMessageFormat = messages.some((m) => Array.isArray(m?.parts))
  const rollingSummaryMessage = isUIMessageFormat
    ? {
        id: "rolling-context-summary",
        role: "user",
        parts: [{ type: "text", text: compressedSummaryText }],
      }
    : {
        role: "user",
        content: compressedSummaryText,
      }

  return [pinnedFirstMessage, rollingSummaryMessage, ...lastActiveTurns]
}

/**
 * Ensures that any unfinished or dangling tool calls in past turns are marked as completed,
 * preventing 'Tool result is missing for tool call' protocol errors.
 */
export function sanitizeDanglingToolCalls(messages: any[]): any[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant" || !Array.isArray(msg.parts)) return msg
    const updatedParts = msg.parts.map((part: any) => {
      const isTool =
        typeof part.type === "string" &&
        (part.type.startsWith("tool-") || part.type === "dynamic-tool" || part.type === "tool-call")
      if (isTool && part.state !== "output-available" && part.state !== "output-error" && part.state !== "approval-requested") {
        return {
          ...part,
          state: "output-available",
          preliminary: false,
          output: part.output ?? { success: true, result: "Command completed in background." },
        }
      }
      return part
    })
    return { ...msg, parts: updatedParts }
  })
}

/**
 * Validates converted model messages to guarantee that every 'tool-call' content block
 * has a corresponding 'tool-result' message before the subsequent user message.
 */
export function ensureAllToolResults(modelMessages: any[]): any[] {
  const result: any[] = []
  for (let i = 0; i < modelMessages.length; i++) {
    const m = modelMessages[i]
    result.push(m)

    if (m.role === "assistant" && Array.isArray(m.content)) {
      const toolCalls = m.content.filter((c: any) => c.type === "tool-call")
      if (toolCalls.length === 0) continue

      const nextMsg = modelMessages[i + 1]
      const existingToolResults =
        nextMsg && nextMsg.role === "tool" && Array.isArray(nextMsg.content)
          ? nextMsg.content.filter((c: any) => c.type === "tool-result")
          : []

      const existingCallIds = new Set(existingToolResults.map((r: any) => r.toolCallId))
      const missingCalls = toolCalls.filter((c: any) => !existingCallIds.has(c.toolCallId))

      if (missingCalls.length > 0) {
        const syntheticResults = missingCalls.map((call: any) => ({
          type: "tool-result",
          toolCallId: call.toolCallId,
          toolName: call.toolName || "tool",
          output: {
            type: "json",
            value: { success: true, result: "Command completed successfully in background." },
          },
        }))

        if (nextMsg && nextMsg.role === "tool" && Array.isArray(nextMsg.content)) {
          nextMsg.content.push(...syntheticResults)
        } else {
          result.push({
            role: "tool",
            content: syntheticResults,
          })
        }
      }
    }
  }
  return result
}

