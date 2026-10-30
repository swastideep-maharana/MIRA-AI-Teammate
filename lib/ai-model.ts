import fs from "fs"
import path from "path"
import { createGroq, groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"

let cachedEnvFile: Record<string, string> | null = null

function getEnvFileMap(): Record<string, string> {
  if (cachedEnvFile !== null) return cachedEnvFile
  cachedEnvFile = {}
  try {
    const envPath = path.resolve(process.cwd(), ".env.local")
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=")
          if (eqIdx !== -1) {
            const k = trimmed.substring(0, eqIdx).trim()
            const v = trimmed.substring(eqIdx + 1).replace(/^["']|["']$/g, "").trim()
            if (k) cachedEnvFile[k] = v
          }
        }
      }
    }
  } catch {
    // Ignore fallback errors
  }
  return cachedEnvFile
}

function resolveEnvKey(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  const envMap = getEnvFileMap()
  return envMap[key]
}

export interface ModelOptions {
  hasAttachments?: boolean
}

export function getLanguageModel(options?: ModelOptions) {
  // 1. Direct Multimodal Context (Gemini 3 Flash 1M+ Token Window):
  // When files/documents (PDFs, docs, spreadsheets, images) are attached,
  // route directly to Gemini 3 Flash for zero-retrieval-loss direct multimodal ingestion!
  if (options?.hasAttachments) {
    const modelName =
      resolveEnvKey("AI_MULTIMODAL_MODEL") ||
      process.env.AI_MULTIMODAL_MODEL ||
      "gemini-3-flash-preview"
    return google(modelName)
  }

  const configuredProvider = (resolveEnvKey("AI_PROVIDER") || process.env.AI_PROVIDER || "").toLowerCase()
  const googleApiKey = resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY") || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const groqApiKey = resolveEnvKey("GROQ_API_KEY") || process.env.GROQ_API_KEY

  // 2. High-Capacity Google Gemini 3 Flash (4M TPM, 1M context window, frontier reasoning):
  // Default to Google Gemini whenever available, or when AI_PROVIDER is explicitly set to 'google'
  if (configuredProvider === "google" || (googleApiKey && configuredProvider !== "groq")) {
    const rawModel =
      resolveEnvKey("AI_MODEL") ||
      process.env.AI_MODEL ||
      "gemini-3-flash-preview"
    // Disallow low-quality/limited gpt-oss models in favor of frontier Gemini 3 Flash
    const cleanModel = rawModel.includes("gpt-oss") || rawModel.includes("/") ? "gemini-3-flash-preview" : rawModel
    return google(cleanModel)
  }

  // 3. Groq Provider fallback if explicitly configured
  if (configuredProvider === "groq" || groqApiKey) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "qwen/qwen3.8-27b"
    const modelName = rawModel.includes("gpt-oss") ? "qwen/qwen3.8-27b" : rawModel
    const groqInstance = groqApiKey ? createGroq({ apiKey: groqApiKey }) : groq
    return groqInstance(modelName)
  }

  // 4. Fallback to Google Gemini 3 Flash
  return google("gemini-3-flash-preview")
}

export function getActiveModelInfo(options?: ModelOptions) {
  if (options?.hasAttachments) {
    return {
      provider: "google (direct multimodal context)",
      model:
        resolveEnvKey("AI_MULTIMODAL_MODEL") ||
        process.env.AI_MULTIMODAL_MODEL ||
        "gemini-3-flash-preview",
      hasKey: Boolean(resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY") || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    }
  }

  const configuredProvider = (resolveEnvKey("AI_PROVIDER") || process.env.AI_PROVIDER || "").toLowerCase()
  const googleApiKey = resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY") || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const groqApiKey = resolveEnvKey("GROQ_API_KEY") || process.env.GROQ_API_KEY

  if (configuredProvider === "google" || (googleApiKey && configuredProvider !== "groq")) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "gemini-3-flash-preview"
    const model = rawModel.includes("gpt-oss") || rawModel.includes("/") ? "gemini-3-flash-preview" : rawModel
    return {
      provider: "google",
      model,
      hasKey: Boolean(googleApiKey),
    }
  }

  if (configuredProvider === "groq" || groqApiKey) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "qwen/qwen3.8-27b"
    const model = rawModel.includes("gpt-oss") ? "qwen/qwen3.8-27b" : rawModel
    return {
      provider: "groq",
      model,
      hasKey: Boolean(groqApiKey),
    }
  }

  return {
    provider: "google",
    model: "gemini-3-flash-preview",
    hasKey: Boolean(googleApiKey),
  }
}
