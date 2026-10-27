import { auth } from "@clerk/nextjs/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { bots, chats } from "@/db/schema"

export async function getUserChats() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return []
    }

    return await db.query.chats.findMany({
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
  } catch (error) {
    console.error("Failed to fetch user chats:", error)
    return []
  }
}

export async function getUserBots() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return []
    }

    return await db.query.bots.findMany({
      where: eq(bots.userId, userId),
      orderBy: [desc(bots.createdAt)],
    })
  } catch (error) {
    console.error("Failed to fetch user bots:", error)
    return []
  }
}

export type UserChatWithBot = Awaited<ReturnType<typeof getUserChats>>[number]
