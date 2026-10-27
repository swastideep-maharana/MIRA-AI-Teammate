import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { chats } from "@/db/schema"

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

export type ChatWithMembers = NonNullable<Awaited<ReturnType<typeof getChat>>>
