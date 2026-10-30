import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"
import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { chats, messages as messagesTable } from "@/db/schema"
import { buildSystemPrompt, type ChatClientData } from "@/lib/chat-prompt"
import { createDaytonaTools } from "@/src/trigger/tools"
import { getDaytona } from "@/lib/daytona"
import { getLanguageModel, getActiveModelInfo } from "@/lib/ai-model"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await req.json()
    const chatId = body.id || body.chatId
    const incomingMessages: UIMessage[] = body.messages || []
    const clientData: ChatClientData | undefined = body.clientData

    if (!chatId) {
      return new Response("Missing chatId", { status: 400 })
    }

    // Verify chat ownership
    const chatRecord = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
      with: {
        members: {
          with: {
            bot: true,
          },
        },
      },
    })

    if (!chatRecord) {
      return new Response("Chat not found", { status: 404 })
    }

    // Identify active bot
    const requestedBot = clientData?.botId
      ? chatRecord.members?.find((m) => m.botId === clientData.botId)?.bot
      : undefined
    const bot = requestedBot ?? chatRecord.members?.[0]?.bot

    const isGroup =
      chatRecord.kind === "group" || (chatRecord.members?.length ?? 0) > 1

    const groupMembers = (chatRecord.members ?? [])
      .map((m) => m.bot)
      .filter(Boolean)
      .map((b) => ({
        id: b.id,
        name: b.name,
        job: b.job,
        instructions: b.instructions,
      }))

    const resolvedClientData: ChatClientData = {
      botId: bot?.id ?? clientData?.botId ?? "",
      botName: bot?.name ?? clientData?.botName ?? "AI Teammate",
      botJob: bot?.job ?? clientData?.botJob ?? "AI Assistant",
      botInstructions:
        bot?.instructions ?? clientData?.botInstructions ?? "",
      sandboxId: bot?.sandboxId ?? clientData?.sandboxId ?? "",
      isGroup,
      chatName: chatRecord.name ?? clientData?.chatName ?? "Group Chat",
      groupMembers,
    }

    // Persist the latest user message if present
    const lastUserMessage = [...incomingMessages].reverse().find((m) => m.role === "user")
    if (lastUserMessage) {
      try {
        await db
          .insert(messagesTable)
          .values({
            id: lastUserMessage.id || nanoid(),
            chatId,
            role: "user",
            parts: lastUserMessage.parts as any,
            metadata: (lastUserMessage as any).metadata || null,
          })
          .onConflictDoNothing()
      } catch (dbErr) {
        console.warn("Could not persist incoming user message:", dbErr)
      }
    }

    // 1. Fetch persistent memory from Daytona sandbox if sandboxId is present
    let memoryContent = ""
    if (resolvedClientData.sandboxId) {
      try {
        const daytona = getDaytona()
        const sandbox = await daytona.get(resolvedClientData.sandboxId)
        if (sandbox) {
          const buf = await sandbox.fs.downloadFile("MEMORY.md")
          memoryContent = buf.toString("utf-8").trim()
        }
      } catch {
        // Sandbox may still be starting or file not written yet
      }
    }

    // Check if any incoming message contains file attachments
    const hasAttachments = incomingMessages.some((m) =>
      m.parts?.some((p) => p.type === "file")
    )

    // Synchronize uploaded files directly to Daytona Linux sandbox (/workspace/uploads/)
    const uploadedFilePaths: string[] = []
    if (resolvedClientData.sandboxId && hasAttachments) {
      try {
        const daytona = getDaytona()
        const sandbox = await daytona.get(resolvedClientData.sandboxId)
        if (sandbox) {
          try {
            await sandbox.process.executeCommand("mkdir -p /workspace/uploads")
          } catch {
            // Ignore if directory exists
          }

          for (const m of incomingMessages) {
            if (m.role === "user" && m.parts) {
              for (const p of m.parts) {
                if (p.type === "file" && (p as any).url?.startsWith("data:")) {
                  const dataUrl = (p as any).url as string
                  const filename = (p as any).filename || `doc-${Date.now()}`
                  const base64Index = dataUrl.indexOf(";base64,")
                  if (base64Index !== -1) {
                    const base64Data = dataUrl.substring(base64Index + 8)
                    const fileBuffer = Buffer.from(base64Data, "base64")
                    const targetPath = `/workspace/uploads/${filename}`
                    try {
                      await sandbox.fs.uploadFile(fileBuffer, targetPath)
                      uploadedFilePaths.push(targetPath)
                      console.log(`[Multimodal Sync] Uploaded ${filename} (${fileBuffer.length} bytes) to ${targetPath}`)
                    } catch (uploadErr) {
                      console.warn(`[Multimodal Sync] Failed to upload ${filename}:`, uploadErr)
                    }
                  }
                }
              }
            }
          }
        }
      } catch (sandboxErr) {
        console.warn("[Multimodal Sync] Sandbox connection error:", sandboxErr)
      }
    }

    // 2. Build system prompt
    let system = buildSystemPrompt(resolvedClientData, memoryContent)
    if (hasAttachments) {
      system += `\n\n### USER ATTACHED DOCUMENTS & MULTIMODAL CONTEXT:
The user has attached documents/files to this conversation.
You have direct multimodal context to read, parse, and analyze the entire document (tables, figures, exact text, page numbers) natively with zero loss.
${
  uploadedFilePaths.length > 0
    ? `The uploaded file(s) have also been synchronized to your Linux container filesystem at:\n${uploadedFilePaths.map((p) => `- \`${p}\``).join("\n")}\nIf the user asks you to run Python/bash commands, scripts, or data extraction on these files, you can access them directly at these paths.`
    : ""
}`
    }

    // 3. Create Daytona tools
    const tools = createDaytonaTools(resolvedClientData)

    // 4. Convert UIMessages to model messages
    const modelMessages = await convertToModelMessages(incomingMessages, { tools })

    // 5. Stream response with Direct Multimodal Context (Gemini 3 Flash for files) or Groq
    const activeModel = getActiveModelInfo({ hasAttachments })
    console.log(`Streaming chat using provider: ${activeModel.provider}, model: ${activeModel.model}`)

    const result = streamText({
      model: getLanguageModel({ hasAttachments }),
      system,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(15),
      maxRetries: 2,
    })

    return result.toUIMessageStreamResponse({
      messageMetadata: () => ({
        botId: resolvedClientData.botId,
        botName: resolvedClientData.botName,
        botJob: resolvedClientData.botJob,
      }),
      onError: (err: unknown) => {
        console.error("AI stream error in /api/chat:", err)
        if (err instanceof Error) {
          if (err.message.includes("quota") || err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
            return "API rate limit reached. Please wait a moment before sending another message."
          }
          if (err.message.includes("high demand") || err.message.includes("503")) {
            return "The AI service is temporarily experiencing high demand. Please try sending your message again."
          }
          return err.message
        }
        return "An error occurred while streaming the AI response. Please try again."
      },
      onFinish: async ({ responseMessage }) => {
        if (responseMessage) {
          const hasContent =
            responseMessage.parts &&
            responseMessage.parts.length > 0 &&
            responseMessage.parts.some(
              (p: any) => p.type !== "text" || Boolean(p.text?.trim())
            )

          if (!hasContent) {
            console.warn("Skipping persistence of empty assistant response.")
            return
          }

          try {
            await db.insert(messagesTable).values({
              id: responseMessage.id || nanoid(),
              chatId,
              role: "assistant",
              parts: responseMessage.parts as any,
              metadata: {
                botId: resolvedClientData.botId,
                botName: resolvedClientData.botName,
                botJob: resolvedClientData.botJob,
              },
            })

            // Update chat last message preview
            let preview = "Active session"
            for (const part of responseMessage.parts) {
              if (part.type === "text" && part.text?.trim()) {
                preview = part.text.trim().slice(0, 120)
                break
              }
            }

            await db
              .update(chats)
              .set({
                lastMessagesPreview: preview,
                lastMessageAt: new Date(),
              })
              .where(eq(chats.id, chatId))
          } catch (persistErr) {
            console.error("Failed to persist assistant response:", persistErr)
          }
        }
      },
    })
  } catch (err: unknown) {
    console.error("Error in /api/chat route:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

