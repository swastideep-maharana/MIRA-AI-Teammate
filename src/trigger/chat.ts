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
import {
  prunePastScreenshots,
  applySlidingWindowContext,
  sanitizeDanglingToolCalls,
  ensureAllToolResults,
} from "../../lib/context-window";

export {
  botMemberSchema,
  chatClientDataSchema,
  type ChatClientData,
  buildSystemPrompt,
  prunePastScreenshots,
  applySlidingWindowContext,
  sanitizeDanglingToolCalls,
  ensureAllToolResults,
};

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
        stopWhen: stepCountIs(10),
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

