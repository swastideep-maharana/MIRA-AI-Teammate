import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs } from "ai";
import { z } from "zod";
import { createDaytonaTools } from "./tools";
import { getDaytona } from "../../lib/daytona";
import { getLanguageModel } from "../../lib/ai-model";
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

export const chatAgent = chat.agent({
  id: "chat-agent",
  clientDataSchema: chatClientDataSchema,
  tools: ({ clientData }) => createDaytonaTools(clientData),
  run: async ({ messages, tools, signal, streamText, clientData }) => {
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

    const hasAttachments = messages.some(
      (m: any) =>
        (Array.isArray(m.experimental_attachments) && m.experimental_attachments.length > 0) ||
        (Array.isArray(m.content) &&
          m.content.some((p: any) => p.type === "file" || p.type === "image")) ||
        (Array.isArray(m.parts) &&
          m.parts.some((p: any) => p.type === "file" || p.type === "image"))
    );

    // Normalize messages so Gemini 3 Flash receives all experimental_attachments as file parts
    const formattedMessages = messages.map((m: any) => {
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

    return streamText({
      model: getLanguageModel({ hasAttachments }),
      system,
      messages: formattedMessages,
      tools,
      stopWhen: stepCountIs(15),
      maxRetries: 2,
      abortSignal: signal,
    });
  },
});

