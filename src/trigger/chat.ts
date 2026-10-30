import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs } from "ai";
import { z } from "zod";
import { createDaytonaTools } from "./tools";
import { getDaytona } from "../../lib/daytona";
import { getLanguageModel } from "../../lib/ai-model";

export const botMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  job: z.string(),
  instructions: z.string().optional().nullable(),
});

export const chatClientDataSchema = z.object({
  botId: z.string().optional(),
  botName: z.string().optional(),
  botJob: z.string().optional(),
  botInstructions: z.string().optional(),
  sandboxId: z.string().optional(),
  isGroup: z.boolean().optional(),
  chatName: z.string().optional(),
  groupMembers: z.array(botMemberSchema).optional(),
});

export type ChatClientData = z.infer<typeof chatClientDataSchema>;

export function buildSystemPrompt(
  clientData?: ChatClientData,
  memoryContent?: string
): string {
  const name = clientData?.botName?.trim() || "AI Teammate";
  const job = clientData?.botJob?.trim() || "AI Teammate";
  const instructions = clientData?.botInstructions?.trim();
  const sandboxId = clientData?.sandboxId?.trim();
  const isGroup = Boolean(clientData?.isGroup);
  const chatName = clientData?.chatName?.trim() || "Group Chat";
  const groupMembers = clientData?.groupMembers || [];

  const otherTeammates = groupMembers.filter(
    (m) =>
      m.id !== clientData?.botId &&
      m.name.toLowerCase() !== name.toLowerCase()
  );

  const sections: string[] = [
    `You are ${name}, an AI teammate working as a ${job}.`,
    `Your role and purpose is to assist thoughtfully, accurately, and collaboratively in this capacity.`,
  ];

  if (instructions) {
    sections.push(`Specific guidelines and role instructions:\n${instructions}`);
  }

  sections.push(
    `### PERSISTENT BOT MEMORY (MEMORY.md):
${
  memoryContent && memoryContent.trim()
    ? memoryContent.trim()
    : "(Your MEMORY.md file is currently blank.)"
}

CRITICAL MEMORY DIRECTIVES:
1. **Always Remember Important Information**: When the user tells you personal facts, secrets, passwords, project preferences, or explicitly says "remember this", you MUST immediately call the \`setMemory\` tool with \`mode: "append"\` to persist it in your sandbox \`MEMORY.md\`.
2. **Cross-Chat Memory Continuity**: Everything saved in your MEMORY.md persists across private 1:1 direct chats and multi-agent group chats.
3. **Recalling Memory in Group Chats**: When a user in a group chat (or 1:1 chat) asks you about a secret, a past conversation, or previously shared info, refer directly to your persistent memory above or invoke \`getMemory\` to retrieve the latest record, and answer accurately. Never claim you don't know something that is recorded in your memory.`
  );

  if (isGroup) {
    let groupSection = `### GROUP CHAT CONTEXT & COLLABORATION:
You are actively participating in a multi-agent GROUP CHAT called "${chatName}".
You are part of a team of specialized AI teammates collaborating in this shared workspace channel.`;

    if (otherTeammates.length > 0) {
      const teammatesList = otherTeammates
        .map((m) => {
          let line = `- **${m.name}** — ${m.job}`;
          if (m.instructions) {
            line += ` (Focus: ${m.instructions.slice(0, 160)}${m.instructions.length > 160 ? "..." : ""})`;
          }
          return line;
        })
        .join("\n");

      groupSection += `\n\nOther AI teammates present in this group:
${teammatesList}

Group Chat Guidelines & Protocols:
1. **Focus on Your Specialty**: Your primary expertise is ${job}. Respond thoughtfully to inquiries and tasks within your wheelhouse.
2. **Handoff When Better Suited**: If the user's prompt or question is better suited for one of the other teammates listed above (e.g. asking for design/UI when a Frontend Developer is present, or infrastructure when a DevOps Engineer is present), call the \`handoff\` tool.
   - Set \`targetBotName\` to the exact name of that teammate and provide a clear \`reason\`.
   - In your message, politely and enthusiastically introduce your teammate, explain why you're handing this over to them, and let the user know they can continue with that teammate.
3. **Collegial Tone**: Act as a supportive, professional colleague to both the user and your fellow AI teammates.
4. **Autonomous Execution**: When a request aligns with your skills, take initiative and use your tools diligently to fulfill it.`;
    } else {
      groupSection += `\n\nOperate collaboratively as a helpful AI teammate within this channel.`;
    }

    sections.push(groupSection);
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

  const toolsSection = [
    `Tools & Capabilities:
You have direct access to computer use, memory, and collaboration tools:
- getMemory: Retrieve your persistent MEMORY.md file from your sandbox to recall facts, user secrets, or notes.
- setMemory: Save, update, or append information to your persistent MEMORY.md file so you remember it forever across 1:1 and group chats.
- bash: Execute terminal commands, run scripts, install packages, and inspect system processes in the sandbox terminal.
- readFile: Inspect and read file contents from the sandbox filesystem.
- writeFile: Write, modify, or create files in the sandbox filesystem.
- listFiles: List files and directory structures in the sandbox filesystem.
- mouseClick: Click anywhere on the desktop display (left, right, or double click).
- mouseMove: Move the cursor to specific coordinates.
- mouseScroll: Scroll vertically up or down at specific coordinates.
- keyboardType: Type text into the active window or input element.
- keyboardPress: Press specific keyboard keys (e.g., 'enter', 'tab', 'escape') or hotkey combos (e.g., 'ctrl+c', 'alt+tab').
- viewScreen: Take a screenshot to inspect what is currently on the screen. Use this internally whenever you need to check GUI applications or evaluate visual progress. Note: this is never rendered in chat for the user.
- showScreen: Capture the screen and display it to the user in chat. Call this whenever the user asks to see what's on the screen or asks what's currently visible.`,
  ];

  if (isGroup && otherTeammates.length > 0) {
    toolsSection.push(
      `- handoff: Hand off the user's request to another AI teammate in this group chat if their job and skills are a better match for the request. Call with \`targetBotName\`, \`reason\`, and optional \`contextMessage\`.`
    );
  }

  toolsSection.push(
    `Always explain your actions clearly and use the tools diligently to complete tasks autonomously.`
  );

  sections.push(toolsSection.join("\n"));

  return sections.join("\n\n");
}

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

    return streamText({
      model: getLanguageModel(),
      system: buildSystemPrompt(clientData, memoryContent),
      messages,
      tools,
      stopWhen: stepCountIs(15),
      abortSignal: signal,
    });
  },
});

