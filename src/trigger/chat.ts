import { chat } from "@trigger.dev/sdk/ai";
import { google } from "@ai-sdk/google";

export const chatAgent = chat.agent({
  id: "chat-agent",
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: google("gemini-3-flash-preview"),
      system:
        "You are a helpful, thoughtful, and capable AI teammate. Provide clear, concise, and structured responses.",
      messages,
      abortSignal: signal,
    }),
});
