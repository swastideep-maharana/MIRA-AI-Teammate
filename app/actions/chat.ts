"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { chats } from "@/db/schema"
import type { chatAgent } from "@/src/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat-agent")

export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const chatRecord = await db.query.chats.findFirst({
    where: and(eq(chats.id, params.chatId), eq(chats.userId, userId)),
    with: {
      members: {
        with: {
          bot: true,
        },
      },
    },
  })

  // If a specific botId was requested in clientData, find it among members; otherwise fallback to first member
  const requestedBot = params.clientData?.botId
    ? chatRecord?.members?.find((m) => m.botId === params.clientData?.botId)?.bot
    : undefined
  const bot = requestedBot ?? chatRecord?.members?.[0]?.bot

  const isGroup =
    chatRecord?.kind === "group" || (chatRecord?.members?.length ?? 0) > 1

  const groupMembers = (chatRecord?.members ?? [])
    .map((m) => m.bot)
    .filter(Boolean)
    .map((b) => ({
      id: b.id,
      name: b.name,
      job: b.job,
      instructions: b.instructions,
    }))

  return start({
    ...params,
    clientData: {
      botId: bot?.id ?? params.clientData?.botId ?? "",
      botName: bot?.name ?? params.clientData?.botName ?? "AI Teammate",
      botJob: bot?.job ?? params.clientData?.botJob ?? "AI Assistant",
      botInstructions:
        bot?.instructions ?? params.clientData?.botInstructions ?? "",
      sandboxId: bot?.sandboxId ?? params.clientData?.sandboxId ?? "",
      isGroup,
      chatName: chatRecord?.name ?? params.clientData?.chatName ?? "Group Chat",
      groupMembers,
    },
  })
}

export async function mintChatAccessToken(chatId: string) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}

const load = chat.createLoadTranscriptAction(defaultStorage, { limit: 50 })

export async function loadChatTranscript(params: {
  chatId: string
  limit?: number
}) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  return load(params)
}
