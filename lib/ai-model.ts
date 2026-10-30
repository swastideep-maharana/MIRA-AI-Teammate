import { groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"

export function getLanguageModel() {
  const provider = process.env.AI_PROVIDER?.toLowerCase()

  // 1. If GROQ_API_KEY is available (or AI_PROVIDER explicitly set to 'groq')
  if (provider === "groq" || (process.env.GROQ_API_KEY && provider !== "google")) {
    const modelName = process.env.AI_MODEL || "openai/gpt-oss-120b"
    return groq(modelName)
  }

  // 2. Fall back to Google Gemini with gemini-2.0-flash (stable free tier, 15 RPM / 1500 RPD)
  const modelName = process.env.AI_MODEL || "gemini-2.0-flash"
  return google(modelName)
}

export function getActiveModelInfo() {
  const provider = process.env.AI_PROVIDER?.toLowerCase()
  if (provider === "groq" || (process.env.GROQ_API_KEY && provider !== "google")) {
    return {
      provider: "groq",
      model: process.env.AI_MODEL || "openai/gpt-oss-120b",
    }
  }
  return {
    provider: "google",
    model: process.env.AI_MODEL || "gemini-2.0-flash",
  }
}

