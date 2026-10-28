import { auth } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { bots, chats, chatMembers, botInsertSchema } from "@/db/schema"
import { daytona } from "@/lib/daytona"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: "Unauthorized. Please sign in." }, { status: 401 })
    }

    const body = await req.json()
    const validated = botInsertSchema.parse(body)

    const botId = nanoid()
    const chatId = nanoid()

    // Create Daytona sandbox with error fallback
    let sandbox: any = null
    let sandboxId: string | null = null
    if (process.env.DAYTONA_API_KEY) {
      try {
        sandbox = await daytona.create()
        sandboxId = sandbox.id
      } catch (daytonaError: any) {
        console.warn("Could not create Daytona sandbox:", daytonaError)
      }
    }

    // Initialize MEMORY.md if sandbox was provisioned
    if (sandbox && sandboxId) {
      void (async () => {
        try {
          if (sandbox.state && sandbox.state !== "started") {
            try {
              await sandbox.start()
            } catch {}
          }
          await sandbox.fs.uploadFile(
            Buffer.from("# MEMORY\n\n", "utf-8"),
            "MEMORY.md"
          )
        } catch (memErr) {
          console.warn("Failed to initialize MEMORY.md:", memErr)
        }
      })()
    }

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

    const newBot = insertedBotRows[0]
    return Response.json({
      bot: {
        ...newBot,
        chatId,
      },
      chatId,
    })
  } catch (err: unknown) {
    console.error("Error creating bot in /api/bots:", err)
    const message = err instanceof Error ? err.message : "Failed to create bot"
    return Response.json({ error: message }, { status: 500 })
  }
}

