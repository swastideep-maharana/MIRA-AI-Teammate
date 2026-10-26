"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { chats, chatMembers, bots } from "@/db/schema"
import { getUserBots } from "@/queries/bots"
import { z } from "zod"

export const createGroupChatSchema = z.object({
  name: z.string().min(1, "Group name is required").max(64, "Name is too long").trim(),
  botIds: z.array(z.string()).min(1, "Select at least one bot"),
})

export type CreateGroupChatInput = z.infer<typeof createGroupChatSchema>

export async function createGroupChat(input: CreateGroupChatInput) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const { name, botIds } = createGroupChatSchema.parse(input)

  // Verify that selected bots belong to this user
  const userBots = await db.query.bots.findMany({
    where: and(eq(bots.userId, userId), inArray(bots.id, botIds)),
  })

  if (userBots.length === 0) {
    throw new Error("No valid bots selected")
  }

  const chatId = nanoid()

  const [newChat] = await db
    .insert(chats)
    .values({
      id: chatId,
      userId,
      kind: "group",
      name,
    })
    .returning()

  await db.insert(chatMembers).values(
    userBots.map((bot) => ({
      chatId,
      botId: bot.id,
    }))
  )

  revalidatePath("/")

  return newChat
}

export async function getUserBotsAction() {
  return getUserBots()
}
