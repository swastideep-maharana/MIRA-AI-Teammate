"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { bots, botInsertSchema, type BotInsert, type Bot } from "@/db/schema"

export async function createBot(data: BotInsert): Promise<Bot> {
  const { isAuthenticated, userId } = await auth()

  if (!userId) {
    throw new Error("Unauthorized")
  }

  const validated = botInsertSchema.parse(data)

  const [newBot] = await db
    .insert(bots)
    .values({
      name: validated.name,
      avatar: validated.avatar,
      job: validated.job,
      instructions: validated.instructions?.trim() || null,
      userId,
    })
    .returning()

  revalidatePath("/")

  return newBot
}
