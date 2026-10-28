import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import type { UIMessage } from "ai"

export async function getChat(chatId: string) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return null
    }

    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
      with: {
        members: {
          with: {
            bot: true,
          },
        },
      },
    })

    return chat ?? null
  } catch (error) {
    console.error(`Failed to fetch chat ${chatId}:`, error)
    return null
  }
}

export async function getChatMessages(chatId: string): Promise<UIMessage[]> {
  try {
    const { userId } = await auth()
    if (!userId) return []

    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
      columns: { id: true },
    })
    if (!chat) return []

    const rows = await db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: [asc(messages.createdAt)],
    })

    return rows.map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      parts: (row.parts as any) || [],
      metadata: (row.metadata as any) || undefined,
    }))
  } catch (error) {
    console.error(`Failed to fetch messages for chat ${chatId}:`, error)
    return []
  }
}

export type ChatWithMembers = NonNullable<Awaited<ReturnType<typeof getChat>>>
