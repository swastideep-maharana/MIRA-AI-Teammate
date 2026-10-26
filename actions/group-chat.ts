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

export const updateGroupChatSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(64, "Name is too long")
    .trim(),
  botIds: z.array(z.string()).min(1, "Select at least one bot"),
})

export type UpdateGroupChatInput = z.infer<typeof updateGroupChatSchema>

export async function updateGroupChat(
  chatId: string,
  input: UpdateGroupChatInput
) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const { name, botIds } = updateGroupChatSchema.parse(input)

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
  })

  if (!chat) {
    throw new Error("Chat not found")
  }

  if (chat.kind !== "group") {
    throw new Error("Cannot edit members of a direct chat")
  }

  const userBots = await db.query.bots.findMany({
    where: and(eq(bots.userId, userId), inArray(bots.id, botIds)),
  })

  if (userBots.length === 0) {
    throw new Error("No valid bots selected")
  }

  await db
    .update(chats)
    .set({ name })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))

  await db.delete(chatMembers).where(eq(chatMembers.chatId, chatId))

  await db.insert(chatMembers).values(
    userBots.map((bot) => ({
      chatId,
      botId: bot.id,
    }))
  )

  revalidatePath("/")
  revalidatePath(`/chats/${chatId}`)

  return { success: true }
}

export async function deleteGroupChat(chatId: string) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
  })

  if (!chat) {
    throw new Error("Chat not found")
  }

  if (chat.kind !== "group") {
    throw new Error("Cannot delete direct chat here")
  }

  await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))

  revalidatePath("/")

  return { success: true }
}
