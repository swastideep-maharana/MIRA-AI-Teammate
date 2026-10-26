"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  bots,
  chats,
  chatMembers,
  botInsertSchema,
  type BotInsert,
  type Bot,
} from "@/db/schema"
import { daytona } from "@/lib/daytona"
import { DaytonaNotFoundError } from "@daytona/sdk"

export async function createBot(data: BotInsert): Promise<Bot> {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const validated = botInsertSchema.parse(data)

  const botId = nanoid()
  const chatId = nanoid()

  // Create Daytona sandbox for this bot
  const sandbox = await daytona.create()
  const sandboxId = sandbox.id

  let botRows: Bot[]
  try {
    const [insertedBotRows] = await db.batch([
      db
        .insert(bots)
        .values({
          id: botId,
          name: validated.name,
          avatar: validated.avatar,
          job: validated.job,
          instructions: validated.instructions?.trim() || null,
          sandboxId,
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
    botRows = insertedBotRows
  } catch (error) {
    // If DB insert fails, cleanup the created sandbox
    try {
      await daytona.delete(sandbox)
    } catch (cleanupError) {
      console.error(`Failed to cleanup sandbox ${sandboxId}:`, cleanupError)
    }
    throw error
  }

  const newBot = botRows[0]

  revalidatePath("/")

  return newBot
}

export async function updateBot(id: string, data: BotInsert): Promise<Bot> {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const validated = botInsertSchema.parse(data)

  const updatedRows = await db
    .update(bots)
    .set({
      name: validated.name,
      avatar: validated.avatar,
      job: validated.job,
      instructions: validated.instructions?.trim() || null,
    })
    .where(and(eq(bots.id, id), eq(bots.userId, userId)))
    .returning()

  if (updatedRows.length === 0) {
    throw new Error("Bot not found or unauthorized")
  }

  const updatedBot = updatedRows[0]

  revalidatePath("/")

  return updatedBot
}

export async function deleteBot(id: string): Promise<void> {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const memberships = await db.query.chatMembers.findMany({
    where: eq(chatMembers.botId, id),
    with: {
      chat: true,
    },
  })

  // Get the bot to retrieve its sandboxId before deleting
  const botToDelete = await db.query.bots.findFirst({
    where: and(eq(bots.id, id), eq(bots.userId, userId)),
  })

  if (!botToDelete) {
    throw new Error("Bot not found or unauthorized")
  }

  const deletedRows = await db
    .delete(bots)
    .where(and(eq(bots.id, id), eq(bots.userId, userId)))
    .returning()

  if (deletedRows.length === 0) {
    throw new Error("Bot not found or unauthorized")
  }

  const directChatIds = memberships
    .filter(
      (m) => m.chat && m.chat.userId === userId && m.chat.kind === "direct"
    )
    .map((m) => m.chatId)

  if (directChatIds.length > 0) {
    await db
      .delete(chats)
      .where(and(inArray(chats.id, directChatIds), eq(chats.userId, userId)))
  }

  // Delete Daytona sandbox if one is associated with this bot
  if (botToDelete.sandboxId) {
    try {
      const sandbox = await daytona.get(botToDelete.sandboxId)
      await daytona.delete(sandbox)
    } catch (error) {
      if (!(error instanceof DaytonaNotFoundError)) {
        console.error(
          `Failed to delete Daytona sandbox ${botToDelete.sandboxId}:`,
          error
        )
      }
    }
  }

  revalidatePath("/")
}


