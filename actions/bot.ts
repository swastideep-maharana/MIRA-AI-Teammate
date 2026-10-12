"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { db } from "@/db"
import {
  bots,
  chats,
  chatMembers,
  botInsertSchema,
  type BotInsert,
  type Bot,
} from "@/db/schema"

export async function createBot(data: BotInsert): Promise<Bot> {
  const { isAuthenticated, userId } = await auth()

  if (!userId) {
    throw new Error("Unauthorized")
  }

  const validated = botInsertSchema.parse(data)

  const botId = nanoid()
  const chatId = nanoid()

  const [botRows] = await db.batch([
    db
      .insert(bots)
      .values({
        id: botId,
        name: validated.name,
        avatar: validated.avatar,
        job: validated.job,
        instructions: validated.instructions?.trim() || null,
        userId,
      })
      .returning(),
    db
      .insert(chats)
      .values({
        id: chatId,
        userId,
        kind: "direct",
        name: null,
      })
      .returning(),
    db
      .insert(chatMembers)
      .values({
        chatId,
        botId,
      })
      .returning(),
  ])

  const newBot = botRows[0]

  revalidatePath("/")

  return newBot
}
