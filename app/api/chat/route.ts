import { streamText, convertToModelMessages } from "ai"
import { google } from "@ai-sdk/google"

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, system } = await req.json()

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google("gemini-3-flash-preview"),
    system:
      system ||
      "You are a helpful, thoughtful, and capable AI teammate. Provide clear, concise, and structured responses.",
    messages: modelMessages,
  })

  return result.toUIMessageStreamResponse()
}
