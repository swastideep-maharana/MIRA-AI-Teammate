"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import { auth } from "@clerk/nextjs/server"
import type { chatAgent } from "@/src/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat-agent")

export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  return start(params)
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
