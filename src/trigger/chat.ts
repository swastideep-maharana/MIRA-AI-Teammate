import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { chats, usageLedgers } from "../../db/schema";
import { createDaytonaTools } from "./tools";
import { getDaytona } from "../../lib/daytona";
import { getLanguageModel } from "../../lib/ai-model";
import { autoHibernateSandbox, ensureSandboxActive } from "../../actions/sandbox";
import {
  botMemberSchema,
  chatClientDataSchema,
  type ChatClientData,
  buildSystemPrompt,
} from "../../lib/chat-prompt";

export {
  botMemberSchema,
  chatClientDataSchema,
  type ChatClientData,
  buildSystemPrompt,
};

function hasScreenshotContent(msg: any): boolean {
  if (Array.isArray(msg.parts)) {
    for (const p of msg.parts) {
      if (
        p.type === "file" &&
        (p.mediaType?.startsWith("image/") || String(p.filename || "").includes("screenshot"))
      ) {
        return true;
      }
      if (p.output?.screenshot || (p.output as any)?.mediaType?.startsWith("image/")) {
        return true;
      }
    }
  }
  if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      if (p.type === "file" || p.type === "image") {
        const mediaType = p.mediaType || p.mimeType || "";
        if (
          mediaType.startsWith("image/") ||
          String(p.filename || "").includes("screenshot") ||
          (typeof p.data === "string" && p.data.startsWith("data:image/"))
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function pruneScreenshotFromMessage(msg: any, stepNum: number): void {
  if (Array.isArray(msg.parts)) {
    for (const p of msg.parts) {
      if (
        p.type === "file" &&
        (p.mediaType?.startsWith("image/") || String(p.filename || "").includes("screenshot"))
      ) {
        p.type = "text";
        p.text = `[Screenshot taken: Desktop state at step ${stepNum} observed]`;
        delete p.url;
        delete p.data;
      }
      if (p.output?.screenshot) {
        p.output.screenshot = `[Screenshot data pruned for context optimization: Desktop state at step ${stepNum} observed]`;
      }
    }
  }
  if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      if (p.type === "file" || p.type === "image") {
        const mediaType = p.mediaType || p.mimeType || "";
        if (
          mediaType.startsWith("image/") ||
          String(p.filename || "").includes("screenshot") ||
          (typeof p.data === "string" && p.data.startsWith("data:image/"))
        ) {
          p.type = "text";
          p.text = `[Screenshot taken: Desktop state at step ${stepNum} observed]`;
          delete p.data;
          delete p.url;
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
        };
      }
      return att;
    });
  }
}

/**
 * Ephemeral visual history: Retains ONLY the single most recent visual screenshot in active context.
 * Converts past screenshots into compact text summaries: `[Screenshot taken: Desktop state at step N observed]`.
 */
export function prunePastScreenshots(messages: any[]): any[] {
  let stepCounter = 0;
  for (const m of messages) {
    if (hasScreenshotContent(m)) {
      stepCounter++;
    }
  }

  let currentStep = stepCounter;
  let hasRetainedLatestScreenshot = false;
  const cloned = JSON.parse(JSON.stringify(messages));

  for (let i = cloned.length - 1; i >= 0; i--) {
    const msg = cloned[i];
    if (hasScreenshotContent(msg)) {
      if (!hasRetainedLatestScreenshot) {
        hasRetainedLatestScreenshot = true;
        currentStep--;
      } else {
        pruneScreenshotFromMessage(msg, currentStep);
        currentStep--;
      }
    }
  }

  return cloned;
}

/**
 * Sliding window context truncation:
 * Pins the core task definition / first prompt, retains the last 6 active turns,
 * and compresses middle turns into a rolling summary when history exceeds 20 turns.
 */
export function applySlidingWindowContext(messages: any[]): any[] {
  const MAX_TURNS = 20;
  const RECENT_ACTIVE_TURNS = 6;

  if (messages.length <= MAX_TURNS) {
    return messages;
  }

  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  const pinnedFirstMessage = firstUserIdx !== -1 ? messages[firstUserIdx] : messages[0];
  const lastActiveTurns = messages.slice(-RECENT_ACTIVE_TURNS);

  const middleStartIndex = firstUserIdx !== -1 ? firstUserIdx + 1 : 1;
  const middleEndIndex = messages.length - RECENT_ACTIVE_TURNS;
  const middleTurns = messages.slice(middleStartIndex, middleEndIndex);

  if (middleTurns.length === 0) {
    return messages;
  }

  const actionSummaries: string[] = [];
  for (const m of middleTurns) {
    if (m.role === "user") {
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
          ? m.content.find((p: any) => p.type === "text")?.text
          : "";
      if (text) {
        actionSummaries.push(`User: "${text.slice(0, 75)}${text.length > 75 ? "..." : ""}"`);
      }
    } else if (m.role === "assistant") {
      const toolNames: string[] = [];
      if (Array.isArray(m.parts)) {
        for (const p of m.parts) {
          if (p.type?.includes("tool") || p.type === "tool-call") {
            toolNames.push(p.toolName || p.name || "tool");
          }
        }
      }
      if (toolNames.length > 0) {
        actionSummaries.push(`Agent used [${toolNames.join(", ")}]`);
      } else {
        const text =
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
            ? m.content.find((p: any) => p.type === "text")?.text
            : "";
        if (text) {
          actionSummaries.push(`Agent noted: "${text.slice(0, 75)}${text.length > 75 ? "..." : ""}"`);
        }
      }
    }
  }

  const compressedSummaryText = `[Context Optimization: ${middleTurns.length} earlier turns compressed into summary to preserve active context window]\nEarlier progress:\n${actionSummaries.slice(0, 10).map((s) => `- ${s}`).join("\n")}`;

  const rollingSummaryMessage = {
    role: "user",
    content: compressedSummaryText,
  };

  return [pinnedFirstMessage, rollingSummaryMessage, ...lastActiveTurns];
}

/**
 * Ensures that any unfinished or dangling tool calls in past turns are marked as completed,
 * preventing 'Tool result is missing for tool call' protocol errors.
 */
export function sanitizeDanglingToolCalls(messages: any[]): any[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant" || !Array.isArray(msg.parts)) return msg;
    const updatedParts = msg.parts.map((part: any) => {
      const isTool =
        typeof part.type === "string" &&
        (part.type.startsWith("tool-") || part.type === "dynamic-tool" || part.type === "tool-call");
      if (isTool && part.state !== "output-available" && part.state !== "output-error") {
        return {
          ...part,
          state: "output-available",
          output: part.output ?? { success: true, result: "Command executed in background." },
        };
      }
      return part;
    });
    return { ...msg, parts: updatedParts };
  });
}

/**
 * Validates converted model messages to guarantee that every 'tool-call' content block
 * has a corresponding 'tool-result' message before the subsequent user message.
 */
export function ensureAllToolResults(modelMessages: any[]): any[] {
  const result = [...modelMessages];
  for (let i = 0; i < result.length; i++) {
    const m = result[i];
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool-call") {
          const callId = block.toolCallId;
          const hasMatchingResult = result.some(
            (other) =>
              other.role === "tool" &&
              Array.isArray(other.content) &&
              other.content.some((b: any) => b.type === "tool-result" && b.toolCallId === callId)
          );
          if (!hasMatchingResult) {
            result.splice(i + 1, 0, {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: callId,
                  toolName: block.toolName || "tool",
                  output: {
                    type: "json",
                    value: { success: true, result: "Command dispatched in background." },
                  },
                },
              ],
            });
            i++;
          }
        }
      }
    }
  }
  return result;
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  clientDataSchema: chatClientDataSchema,
  tools: ({ clientData }) => createDaytonaTools(clientData),
  run: async ({ messages, tools, signal, streamText, clientData }) => {
    const taskStartTime = Date.now();

    // Wake-on-interaction fallback: ensure hibernated sandbox is active before task runs
    if (clientData?.sandboxId) {
      try {
        await ensureSandboxActive(clientData.sandboxId);
      } catch (wakeErr) {
        console.warn("[Lifecycle] Wake-on-interaction warning for sandbox:", wakeErr);
      }
    }

    let memoryContent = "";
    if (clientData?.sandboxId) {
      try {
        const daytona = getDaytona();
        const sandbox = await daytona.get(clientData.sandboxId);
        if (sandbox) {
          const buf = await sandbox.fs.downloadFile("MEMORY.md");
          memoryContent = buf.toString("utf-8").trim();
        }
      } catch {
        // Sandbox may be starting or file not yet written
      }
    }

    chat.setUIMessageStreamOptions({
      messageMetadata: () => ({
        botId: clientData?.botId,
        botName: clientData?.botName,
        botJob: clientData?.botJob,
      }),
    });

    // 1. Sliding window context truncation (caps history at 20 turns while preserving first + rolling + last 6)
    const windowedMessages = applySlidingWindowContext(messages);

    const hasAttachments = windowedMessages.some(
      (m: any) =>
        (Array.isArray(m.experimental_attachments) && m.experimental_attachments.length > 0) ||
        (Array.isArray(m.content) &&
          m.content.some((p: any) => p.type === "file" || p.type === "image")) ||
        (Array.isArray(m.parts) &&
          m.parts.some((p: any) => p.type === "file" || p.type === "image"))
    );

    // 2. Normalize messages for multimodal parts
    const formattedMessages = windowedMessages.map((m: any) => {
      if (
        m.role === "user" &&
        Array.isArray(m.experimental_attachments) &&
        m.experimental_attachments.length > 0
      ) {
        const existingParts = Array.isArray(m.content)
          ? m.content
          : typeof m.content === "string" && m.content.trim()
          ? [{ type: "text", text: m.content }]
          : [];

        const attachmentParts = m.experimental_attachments.map((att: any) => ({
          type: "file",
          mimeType: att.contentType || "application/octet-stream",
          data: att.url,
          filename: att.name,
        }));

        if (attachmentParts.length > 0 && existingParts.length === 0) {
          existingParts.push({
            type: "text",
            text: "Please inspect, analyze, and summarize this attached document/file.",
          });
        }

        return {
          ...m,
          content: [...existingParts, ...attachmentParts],
        };
      }
      return m;
    });

    // 3. Ephemeral visual history: prune past screenshots in-memory retaining ONLY the single latest screenshot
    const sanitizedFormatted = sanitizeDanglingToolCalls(formattedMessages);
    const modelOptimizedMessages = ensureAllToolResults(prunePastScreenshots(sanitizedFormatted));

    // Synchronize uploaded files directly to Daytona Linux sandbox (/workspace/uploads/)
    const uploadedPaths: string[] = [];
    if (clientData?.sandboxId && hasAttachments) {
      try {
        const daytona = getDaytona();
        const sandbox = await daytona.get(clientData.sandboxId);
        if (sandbox) {
          try {
            await sandbox.process.executeCommand("mkdir -p /workspace/uploads");
          } catch {}

          for (const m of messages as any[]) {
            if (m.role === "user") {
              if (Array.isArray(m.experimental_attachments)) {
                for (const att of m.experimental_attachments) {
                  if (att.url?.startsWith("data:")) {
                    const filename = att.name || `doc-${Date.now()}`;
                    const base64Index = att.url.indexOf(";base64,");
                    if (base64Index !== -1) {
                      const base64Data = att.url.substring(base64Index + 8);
                      const fileBuffer = Buffer.from(base64Data, "base64");
                      const targetPath = `/workspace/uploads/${filename}`;
                      try {
                        await sandbox.fs.uploadFile(fileBuffer, targetPath);
                        uploadedPaths.push(targetPath);
                      } catch {}
                    }
                  }
                }
              }

              if (Array.isArray(m.content)) {
                for (const p of m.content) {
                  if (p.type === "file") {
                    const dataUrl =
                      typeof p.data === "string"
                        ? p.data
                        : p.data?.url
                        ? p.data.url
                        : p.url;
                    if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
                      const filename = p.filename || `doc-${Date.now()}`;
                      const base64Index = dataUrl.indexOf(";base64,");
                      if (base64Index !== -1) {
                        const base64Data = dataUrl.substring(base64Index + 8);
                        const fileBuffer = Buffer.from(base64Data, "base64");
                        const targetPath = `/workspace/uploads/${filename}`;
                        try {
                          await sandbox.fs.uploadFile(fileBuffer, targetPath);
                          if (!uploadedPaths.includes(targetPath)) {
                            uploadedPaths.push(targetPath);
                          }
                        } catch {}
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch {}
    }

    let system = buildSystemPrompt(clientData, memoryContent);
    if (uploadedPaths.length > 0) {
      system += `\n\n### SYNCHRONIZED SANDBOX FILES:
The user's uploaded files are also accessible on your Linux container filesystem at:
${uploadedPaths.map((p) => `- \`${p}\``).join("\n")}
You can inspect, extract, or process these files directly using Python, grep, or terminal tools.`;
    }

    try {
      return streamText({
        model: getLanguageModel({ hasAttachments }),
        system,
        messages: modelOptimizedMessages,
        tools,
        stopWhen: stepCountIs(8),
        maxRetries: 2,
        abortSignal: signal,
        onFinish: async ({ usage }) => {
          try {
            const taskEndTime = Date.now();
            const sandboxDurationSeconds = Math.max(1, Math.round((taskEndTime - taskStartTime) / 1000));
            const usageObj = usage as any;
            const promptTokens = usageObj?.promptTokens ?? usageObj?.inputTokens ?? 0;
            const completionTokens = usageObj?.completionTokens ?? usageObj?.outputTokens ?? 0;
            const totalTokens = usageObj?.totalTokens ?? (promptTokens + completionTokens);

            // Estimated token costs: Gemini 3 Flash / 2.5 ($0.15/1M input, $0.60/1M output, $0.036/hr sandbox)
            const estimatedCostUsd = Number(
              (
                promptTokens * 0.00000015 +
                completionTokens * 0.00000060 +
                (clientData?.sandboxId ? sandboxDurationSeconds * 0.00001 : 0)
              ).toFixed(6)
            );

            let effectiveUserId = clientData?.userId;
            if (!effectiveUserId && clientData?.chatId) {
              const chatRecord = await db.query.chats.findFirst({
                where: eq(chats.id, clientData.chatId),
              });
              effectiveUserId = chatRecord?.userId;
            }

            if (effectiveUserId) {
              await db.insert(usageLedgers).values({
                userId: effectiveUserId,
                botId: clientData?.botId || null,
                chatId: clientData?.chatId || null,
                promptTokens,
                completionTokens,
                totalTokens,
                sandboxDurationSeconds: clientData?.sandboxId ? sandboxDurationSeconds : 0,
                estimatedCostUsd,
              });
              console.log(
                `[UsageLedger] Turn persisted: ${totalTokens} tokens, ${sandboxDurationSeconds}s sandbox, $${estimatedCostUsd} for user ${effectiveUserId}`
              );
            }
          } catch (meterErr) {
            console.warn("[UsageLedger] Safe warning: failed to persist usage ledger turn:", meterErr);
          }
        },
      });
    } catch (agentErr) {
      // Orphan prevention: cleanly hibernate sandbox if unhandled task error occurs
      if (clientData?.sandboxId) {
        try {
          await autoHibernateSandbox(clientData.sandboxId, true);
        } catch {}
      }
      throw agentErr;
    }
  },
});

