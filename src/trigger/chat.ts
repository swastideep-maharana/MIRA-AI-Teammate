import { chat } from "@trigger.dev/sdk/ai";
import { google } from "@ai-sdk/google";
import { stepCountIs } from "ai";
import { z } from "zod";
import { createDaytonaTools } from "./tools";

export const chatClientDataSchema = z.object({
  botName: z.string().optional(),
  botJob: z.string().optional(),
  botInstructions: z.string().optional(),
  sandboxId: z.string().optional(),
});

export type ChatClientData = z.infer<typeof chatClientDataSchema>;

export function buildSystemPrompt(clientData?: ChatClientData): string {
  const name = clientData?.botName?.trim() || "AI Teammate";
  const job = clientData?.botJob?.trim() || "AI Teammate";
  const instructions = clientData?.botInstructions?.trim();
  const sandboxId = clientData?.sandboxId?.trim();

  const sections: string[] = [
    `You are ${name}, an AI teammate working as a ${job}.`,
    `Your role and purpose is to assist thoughtfully, accurately, and collaboratively in this capacity.`,
  ];

  if (instructions) {
    sections.push(`Specific guidelines and purpose:\n${instructions}`);
  }

  if (sandboxId) {
    sections.push(
      `Environment:\nYou are operating within a dedicated, isolated cloud sandbox environment (Sandbox ID: ${sandboxId}).`
    );
  } else {
    sections.push(
      `Environment:\nYou are operating within a dedicated, isolated cloud sandbox environment.`
    );
  }

  sections.push(
    `Tools & Computer Use Capabilities:
You have direct access to computer use and development tools in the sandbox environment:
- bash: Execute terminal commands, run scripts, install packages, and inspect system processes.
- readFile: Inspect and read file contents from the sandbox filesystem.
- writeFile: Write, modify, or create files in the sandbox filesystem.
- listFiles: List files and directory structures in the sandbox filesystem.
- mouseClick: Click anywhere on the desktop display (left, right, or double click).
- mouseMove: Move the cursor to specific coordinates.
- mouseScroll: Scroll vertically up or down at specific coordinates.
- keyboardType: Type text into the active window or input element.
- keyboardPress: Press specific keyboard keys (e.g., 'enter', 'tab', 'escape') or hotkey combos (e.g., 'ctrl+c', 'alt+tab').
- viewScreen: Take a screenshot to inspect what is currently on the screen. Use this internally whenever you need to check GUI applications or evaluate visual progress. Note: this is never rendered in chat for the user.
- showScreen: Capture the screen and display it to the user in chat. Call this whenever the user asks to see what's on the screen or asks what's currently visible.

Always explain your actions clearly and use the tools diligently to complete tasks autonomously.`
  );

  return sections.join("\n\n");
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  clientDataSchema: chatClientDataSchema,
  tools: ({ clientData }) => createDaytonaTools(clientData),
  run: async ({ messages, tools, signal, streamText, clientData }) =>
    streamText({
      model: google("gemini-3-flash-preview"),
      system: buildSystemPrompt(clientData),
      messages,
      tools,
      stopWhen: stepCountIs(15),
      abortSignal: signal,
    }),
});

