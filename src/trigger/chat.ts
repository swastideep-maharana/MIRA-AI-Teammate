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

    const hasAttachments = messages.some((m: any) =>
      Array.isArray(m.content) &&
      m.content.some((p: any) => p.type === "file" || p.type === "image")
    );

    // Synchronize uploaded files directly to Daytona Linux sandbox (/workspace/uploads/)
    if (clientData?.sandboxId && hasAttachments) {
      try {
        const daytona = getDaytona();
        const sandbox = await daytona.get(clientData.sandboxId);
        if (sandbox) {
          try {
            await sandbox.process.executeCommand("mkdir -p /workspace/uploads");
          } catch {}

          for (const m of messages as any[]) {
            if (m.role === "user" && Array.isArray(m.content)) {
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
                      try {
                        await sandbox.fs.uploadFile(
                          fileBuffer,
                          `/workspace/uploads/${filename}`
                        );
                      } catch {}
                    }
                  }
                }
              }
            }
          }
        }
      } catch {}
    }

    return streamText({
      model: getLanguageModel({ hasAttachments }),
      system: buildSystemPrompt(clientData, memoryContent),
      messages,
      tools,
      stopWhen: stepCountIs(15),
      abortSignal: signal,
    });
  },
});

