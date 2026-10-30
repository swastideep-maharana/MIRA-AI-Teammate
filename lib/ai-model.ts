import fs from "fs"
import path from "path"
import { createGroq, groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"
import { wrapLanguageModel, type LanguageModel } from "ai"
import type { LanguageModelV4 } from "@ai-sdk/provider"

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

/**
 * Returns true if the given error indicates an API rate limit, quota exhaustion,
 * temporary concurrency ceiling, or server-side service overload.
 */
export function isRateLimitOrQuotaError(err: unknown): boolean {
  if (!err) return false
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  const status = (err as any)?.status || (err as any)?.statusCode

  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("tokens per minute") ||
    msg.includes("tpm") ||
    msg.includes("request too large") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("service unavailable") ||
    msg.includes("capacity")
  )
}

/**
 * Wraps a primary LanguageModel with an ordered list of fallback models.
 * If the primary model encounters a rate limit (429, TPM, quota exceeded, 503),
 * it seamlessly fails over to the next candidate model in the chain so the user's
 * conversation stream continues without disruption.
 */
export function createResilientLanguageModel(
  primaryModel: LanguageModelV4,
  fallbackModels: LanguageModelV4[]
): LanguageModelV4 {
  const allModels = [primaryModel, ...fallbackModels.filter((m) => m && m !== primaryModel)]
  if (allModels.length <= 1) {
    return primaryModel
  }

  return wrapLanguageModel({
    model: primaryModel,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        let lastErr: unknown
        for (let i = 0; i < allModels.length; i++) {
          const candidate = allModels[i]
          try {
            if (i === 0) {
              return await doGenerate()
            } else {
              console.warn(
                `[AI Resilience] Falling back generate to model: ${candidate.modelId} (${candidate.provider})`
              )
              return await candidate.doGenerate(params)
            }
          } catch (err) {
            lastErr = err
            const isLast = i === allModels.length - 1
            if (isRateLimitOrQuotaError(err) && !isLast) {
              console.warn(
                `[AI Resilience] Model ${candidate.modelId} rate limited / failed (${(err as Error).message}). Trying next candidate...`
              )
              continue
            }
            throw err
          }
        }
        throw lastErr
      },
      wrapStream: async ({ doStream, params }) => {
        let lastErr: unknown
        for (let i = 0; i < allModels.length; i++) {
          const candidate = allModels[i]
          try {
            if (i === 0) {
              return await doStream()
            } else {
              console.warn(
                `[AI Resilience] Seamlessly falling back stream to model: ${candidate.modelId} (${candidate.provider})`
              )
              return await candidate.doStream(params)
            }
          } catch (err) {
            lastErr = err
            const isLast = i === allModels.length - 1
            if (isRateLimitOrQuotaError(err) && !isLast) {
              console.warn(
                `[AI Resilience] Model ${candidate.modelId} stream rate limited / failed (${(err as Error).message}). Seamlessly engaging fallback model...`
              )
              continue
            }
            throw err
          }
        }
        throw lastErr
      },
    },
  }) as LanguageModelV4
}

export function getLanguageModel(options?: ModelOptions): LanguageModelV4 {
  const configuredProvider = (resolveEnvKey("AI_PROVIDER") || process.env.AI_PROVIDER || "").toLowerCase()
  const googleApiKey = resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY") || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const groqApiKey = resolveEnvKey("GROQ_API_KEY") || process.env.GROQ_API_KEY
  const groqInstance = groqApiKey ? createGroq({ apiKey: groqApiKey }) : groq

  // 1. Direct Multimodal Context (Files / attachments attached):
  // Uses Gemini 2.5 Flash / 3 Flash with fallback to Gemini 1.5 Flash
  if (options?.hasAttachments) {
    const rawMultiModel =
      resolveEnvKey("AI_MULTIMODAL_MODEL") ||
      process.env.AI_MULTIMODAL_MODEL ||
      "gemini-2.5-flash"
    const primary = google(rawMultiModel)
    const fallbacks: LanguageModelV4[] = [
      google("gemini-2.5-flash"),
      google("gemini-3-flash-preview"),
      google("gemini-1.5-flash"),
    ]
    return createResilientLanguageModel(primary, fallbacks)
  }

  // 2. High-Capacity Google Gemini with Multi-Tier Fallback:
  if (configuredProvider === "google" || (googleApiKey && configuredProvider !== "groq")) {
    const rawModel =
      resolveEnvKey("AI_MODEL") ||
      process.env.AI_MODEL ||
      "gemini-2.5-flash"
    const cleanModel = rawModel.includes("gpt-oss") || rawModel.includes("/") ? "gemini-2.5-flash" : rawModel
    const primary = google(cleanModel)

    const fallbacks: LanguageModelV4[] = [
      google("gemini-2.5-flash"),
      google("gemini-3-flash-preview"),
      google("gemini-2.0-flash"),
      google("gemini-1.5-flash"),
    ]

    // Cross-provider fallback to Groq if Groq key is available:
    if (groqApiKey) {
      fallbacks.push(groqInstance("llama-3.3-70b-versatile"))
      fallbacks.push(groqInstance("qwen/qwen3.8-27b"))
    }

    return createResilientLanguageModel(primary, fallbacks)
  }

  // 3. Groq Provider with Fallback Chain:
  if (configuredProvider === "groq" || groqApiKey) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "llama-3.3-70b-versatile"
    const cleanModel = rawModel.includes("gpt-oss") ? "llama-3.3-70b-versatile" : rawModel
    const primary = groqInstance(cleanModel)

    const fallbacks: LanguageModelV4[] = [
      groqInstance("llama-3.3-70b-versatile"),
      groqInstance("qwen/qwen3.8-27b"),
      groqInstance("llama-3.1-8b-instant"),
    ]

    // Cross-provider fallback to Google if Google key is available:
    if (googleApiKey) {
      fallbacks.push(google("gemini-2.5-flash"))
      fallbacks.push(google("gemini-1.5-flash"))
    }

    return createResilientLanguageModel(primary, fallbacks)
  }

  // 4. Ultimate Fallback to Gemini 2.5 Flash with fallback chain
  const defaultPrimary = google("gemini-2.5-flash")
  const defaultFallbacks: LanguageModelV4[] = [google("gemini-1.5-flash"), google("gemini-2.0-flash")]
  return createResilientLanguageModel(defaultPrimary, defaultFallbacks)
}

export function getActiveModelInfo(options?: ModelOptions) {
  if (options?.hasAttachments) {
    return {
      provider: "google (direct multimodal context with fallback)",
      model:
        resolveEnvKey("AI_MULTIMODAL_MODEL") ||
        process.env.AI_MULTIMODAL_MODEL ||
        "gemini-2.5-flash",
      hasKey: Boolean(resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY") || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    }
  }

  const configuredProvider = (resolveEnvKey("AI_PROVIDER") || process.env.AI_PROVIDER || "").toLowerCase()
  const googleApiKey = resolveEnvKey("GOOGLE_GENERATIVE_AI_API_KEY") || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const groqApiKey = resolveEnvKey("GROQ_API_KEY") || process.env.GROQ_API_KEY

  if (configuredProvider === "google" || (googleApiKey && configuredProvider !== "groq")) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "gemini-2.5-flash"
    const model = rawModel.includes("gpt-oss") || rawModel.includes("/") ? "gemini-2.5-flash" : rawModel
    return {
      provider: "google (multi-tier resilient fallback)",
      model,
      hasKey: Boolean(googleApiKey),
    }
  }

  if (configuredProvider === "groq" || groqApiKey) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "llama-3.3-70b-versatile"
    const model = rawModel.includes("gpt-oss") ? "llama-3.3-70b-versatile" : rawModel
    return {
      provider: "groq (multi-tier resilient fallback)",
      model,
      hasKey: Boolean(groqApiKey),
    }
  }

  return {
    provider: "google",
    model: "gemini-2.5-flash",
    hasKey: Boolean(googleApiKey),
  }
}

