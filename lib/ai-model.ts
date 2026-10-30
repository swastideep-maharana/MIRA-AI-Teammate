import fs from "fs"
import path from "path"
import { createGroq, groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"

function resolveEnvKey(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const envPath = path.resolve(process.cwd(), ".env.local")
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.startsWith(`${key}=`)) {
          const val = trimmed.substring(key.length + 1).replace(/^["']|["']$/g, "").trim()
          if (val) return val
        }
      }
    }
  } catch {
    // Ignore fallback errors
  }
  return undefined
}

export function getLanguageModel() {
  const provider = (resolveEnvKey("AI_PROVIDER") || process.env.AI_PROVIDER || "groq").toLowerCase()
  const groqApiKey = resolveEnvKey("GROQ_API_KEY")

  // 1. Default to Groq if GROQ_API_KEY is available (or AI_PROVIDER explicitly set to 'groq')
  if (provider === "groq" || (groqApiKey && provider !== "google")) {
    const modelName = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "openai/gpt-oss-120b"
    const groqInstance = groqApiKey ? createGroq({ apiKey: groqApiKey }) : groq
    return groqInstance(modelName)
  }

  // 2. Google Gemini fallback (use gemini-3.8-flash for current API specifications)
  const modelName = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "gemini-3.8-flash"
  return google(modelName)
}

export function getActiveModelInfo() {
  const provider = (resolveEnvKey("AI_PROVIDER") || process.env.AI_PROVIDER || "groq").toLowerCase()
  const groqApiKey = resolveEnvKey("GROQ_API_KEY")

  if (provider === "groq" || (groqApiKey && provider !== "google")) {
    return {
      provider: "groq",
      model: resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "openai/gpt-oss-120b",
      hasKey: Boolean(groqApiKey),
    }
  }
  return {
    provider: "google",
    model: resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "gemini-3.8-flash",
    hasKey: Boolean(resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY")),
  }
}
