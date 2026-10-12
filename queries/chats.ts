import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { chats } from "@/db/schema"

export async function getChat(chatId: string) {
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
}

export type ChatWithMembers = NonNullable<Awaited<ReturnType<typeof getChat>>>
