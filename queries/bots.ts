import { auth } from "@clerk/nextjs/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { bots, chats } from "@/db/schema"

export async function getUserChats() {
  const { userId } = await auth()

  if (!userId) {
    return []
  }

  return db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.lastMessageAt)],
    with: {
      members: {
        with: {
          bot: true,
        },
      },
    },
  })
}

export async function getUserBots() {
  const { userId } = await auth()

  if (!userId) {
    return []
  }

  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    orderBy: [desc(bots.createdAt)],
  })
}

export type UserChatWithBot = Awaited<ReturnType<typeof getUserChats>>[number]
