"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { chats, messages as messagesTable } from "@/db/schema"
import { getDaytona } from "@/lib/daytona"
import { chatAgent, type ChatClientData } from "@/src/trigger/chat"

export interface ChatAttachment {
  name: string
  contentType: string
  url: string
}

export interface StartChatSessionParams {
  chatId: string
  promptText?: string
  attachments?: ChatAttachment[]
  clientData?: ChatClientData
}

export async function startChatSession({
  chatId,
  promptText = "",
  attachments = [],
  clientData,
}: StartChatSessionParams) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized: You must be logged in to chat.")
  }

  // 1. Verify chat ownership
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
    throw new Error("Chat session not found.")
  }

  const targetBot = clientData?.botId
    ? chatRecord.members?.find((m) => m.botId === clientData.botId)?.bot
    : chatRecord.members?.[0]?.bot

  const sandboxId = targetBot?.sandboxId || clientData?.sandboxId

  // 2. Sync uploaded files to Daytona Linux container filesystem (/workspace/uploads/<filename>)
  const syncedFiles: string[] = []
  if (sandboxId && attachments && attachments.length > 0) {
    try {
      const daytona = getDaytona()
      const sandbox = await daytona.get(sandboxId)
      if (sandbox) {
        try {
          await sandbox.process.executeCommand("mkdir -p /workspace/uploads")
        } catch {}

        for (const file of attachments) {
          if (file.url && file.url.startsWith("data:")) {
            const base64Index = file.url.indexOf(";base64,")
            if (base64Index !== -1) {
              const base64Data = file.url.substring(base64Index + 8)
              const buffer = Buffer.from(base64Data, "base64")
              const targetPath = `/workspace/uploads/${file.name}`
              try {
                await sandbox.fs.uploadFile(buffer, targetPath)
                syncedFiles.push(targetPath)
                console.log(`[Sandbox Sync] Successfully uploaded ${file.name} to ${targetPath}`)
              } catch (uploadErr) {
                console.warn(`[Sandbox Sync] Failed to upload ${file.name}:`, uploadErr)
              }
            }
          }
        }
      }
    } catch (sandboxErr) {
      console.warn("Could not connect to Daytona sandbox for file sync:", sandboxErr)
    }
  }

  // 3. Construct user message conforming to AI SDK CoreMessage spec with experimental_attachments
  const parts: Array<any> = []
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      parts.push({
        type: "file",
        mediaType: att.contentType,
        url: att.url,
        filename: att.name,
      })
    }
  }
  if (promptText.trim()) {
    parts.push({ type: "text", text: promptText.trim() })
  }

  const userMessage = {
    role: "user" as const,
    content: promptText.trim(),
    parts,
    experimental_attachments: attachments.map((att) => ({
      name: att.name,
      contentType: att.contentType,
      url: att.url,
    })),
  }

  // 4. Persist user message to database
  const messageId = nanoid()
  try {
    await db.insert(messagesTable).values({
      id: messageId,
      chatId,
      role: "user",
      parts: parts as any,
      metadata: {
        botId: targetBot?.id,
        botName: targetBot?.name,
        attachments: attachments.map((a) => ({ name: a.name, contentType: a.contentType })),
        syncedFiles,
      } as any,
    })
  } catch (dbErr) {
    console.warn("Failed to persist user message in startChatSession:", dbErr)
  }

  // 5. Trigger Trigger.dev chatAgent task
  let taskRunId: string | undefined
  try {
    const handle = await chatAgent.trigger({
      chatId,
      trigger: "submit-message",
      message: userMessage as any,
      metadata: {
        botId: targetBot?.id || clientData?.botId,
        botName: targetBot?.name || clientData?.botName,
        botJob: targetBot?.job || clientData?.botJob,
        botInstructions: targetBot?.instructions || clientData?.botInstructions,
        sandboxId,
        isGroup: chatRecord.kind === "group" || (chatRecord.members?.length ?? 0) > 1,
        chatName: chatRecord.name || "Chat",
        groupMembers: (chatRecord.members || []).map((m) => ({
          id: m.bot.id,
          name: m.bot.name,
          job: m.bot.job,
          instructions: m.bot.instructions,
        })),
      },
    })
    taskRunId = handle.id
  } catch (triggerErr) {
    console.warn("Could not trigger chatAgent task (client may use direct API streaming):", triggerErr)
  }

  return {
    success: true,
    messageId,
    taskRunId,
    syncedFiles,
    userMessage,
  }
}
