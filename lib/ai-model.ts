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
 * temporary concurrency ceiling, server-side service overload, or invalid/deprecated model.
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
    status === 404 ||
    status === 400 ||
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
    msg.includes("capacity") ||
    msg.includes("not found") ||
    msg.includes("no longer available") ||
    msg.includes("deprecated") ||
    msg.includes("does not exist") ||
    msg.includes("cannot find model") ||
    msg.includes("do not have access") ||
    msg.includes("access to it") ||
    msg.includes("permission_denied") ||
    msg.includes("unauthorized") ||
    msg.includes("non-image file content parts") ||
    msg.includes("unsupportedfunctionalityerror") ||
    msg.includes("functionality not supported") ||
    msg.includes("not supported")
  )
}

/**
 * Sanitizes model parameters before calling a specific provider.
 * Providers like Groq support image URLs/data but do NOT support non-image file content parts (e.g. PDFs, docs).
 * For non-image parts, we convert them into descriptive text so Groq never throws UnsupportedFunctionalityError.
 */
function adaptParamsForCandidate(params: any, candidate: LanguageModelV4): any {
  const isGroq =
    candidate.provider?.includes("groq") ||
    (candidate as any).modelId?.includes("qwen") ||
    (candidate as any).modelId?.includes("gpt-oss")
  if (!isGroq || !Array.isArray(params.prompt)) return params

  const adaptedPrompt = params.prompt.map((msg: any) => {
    if (!Array.isArray(msg.content)) return msg
    const adaptedContent = msg.content.map((part: any) => {
      if (part.type === "file") {
        const mediaType = part.mediaType || ""
        if (!mediaType.startsWith("image/")) {
          const filename = part.filename || "attached document"
          const textContent =
            part.data?.type === "text" && typeof part.data?.text === "string"
              ? `\nContent:\n${part.data.text}`
              : ""
          return {
            type: "text",
            text: `[Attached Document: ${filename} (${mediaType || "file"})]${textContent}`,
          }
        }
      }
      return part
    })
    return { ...msg, content: adaptedContent }
  })

  return {
    ...params,
    prompt: adaptedPrompt,
  }
}

/**
 * Wraps a primary LanguageModel with an ordered list of fallback models.
 * If the primary model encounters a rate limit (429, TPM, quota exceeded, 503, or 404 deprecated),
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
            const adaptedParams = adaptParamsForCandidate(params, candidate)
            if (i === 0 && !candidate.provider?.includes("groq")) {
              return await doGenerate()
            } else {
              if (i > 0) {
                console.warn(
                  `[AI Resilience] Falling back generate to model: ${candidate.modelId} (${candidate.provider})`
                )
              }
              return await candidate.doGenerate(adaptedParams)
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
            const adaptedParams = adaptParamsForCandidate(params, candidate)
            if (i === 0 && !candidate.provider?.includes("groq")) {
              return await doStream()
            } else {
              if (i > 0) {
                console.warn(
                  `[AI Resilience] Seamlessly falling back stream to model: ${candidate.modelId} (${candidate.provider})`
                )
              }
              return await candidate.doStream(adaptedParams)
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
  // Uses Gemini 3 Flash Preview with multi-tier Google & Groq fallbacks
  if (options?.hasAttachments) {
    const rawMultiModel =
      resolveEnvKey("AI_MULTIMODAL_MODEL") ||
      process.env.AI_MULTIMODAL_MODEL ||
      "gemini-3-flash-preview"
    const cleanMultiModel = rawMultiModel.includes("2.5") || rawMultiModel.includes("gpt-oss")
      ? "gemini-3-flash-preview"
      : rawMultiModel
    const primary = google(cleanMultiModel)
    const fallbacks: LanguageModelV4[] = [
      google("gemini-3-flash-preview"),
      google("gemini-3.5-flash"),
      google("gemini-2.0-flash"),
      google("gemini-1.5-flash"),
    ]
    if (groqApiKey) {
      fallbacks.push(groqInstance("qwen/qwen3.8-27b"))
    }
    return createResilientLanguageModel(primary, fallbacks)
  }

  // 2. High-Capacity Google Gemini with Multi-Tier Fallback:
  if (configuredProvider === "google" || (googleApiKey && configuredProvider !== "groq")) {
    const rawModel =
      resolveEnvKey("AI_MODEL") ||
      process.env.AI_MODEL ||
      "gemini-3-flash-preview"
    const cleanModel =
      rawModel.includes("2.5") || rawModel.includes("gpt-oss") || rawModel.includes("/")
        ? "gemini-3-flash-preview"
        : rawModel
    const primary = google(cleanModel)

    const fallbacks: LanguageModelV4[] = [
      google("gemini-3-flash-preview"),
      google("gemini-3.5-flash"),
      google("gemini-2.0-flash"),
      google("gemini-1.5-flash"),
    ]

    // Cross-provider fallback to Groq if Groq key is available:
    if (groqApiKey) {
      fallbacks.push(groqInstance("qwen/qwen3.8-27b"))
      fallbacks.push(groqInstance("openai/gpt-oss-20b"))
    }

    return createResilientLanguageModel(primary, fallbacks)
  }

  // 3. Groq Provider with Fallback Chain:
  if (configuredProvider === "groq" || groqApiKey) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "qwen/qwen3.8-27b"
    const cleanModel = rawModel.includes("gpt-oss") || rawModel.includes("2.5") ? "qwen/qwen3.8-27b" : rawModel
    const primary = groqInstance(cleanModel)

    const fallbacks: LanguageModelV4[] = [
      groqInstance("qwen/qwen3.8-27b"),
      groqInstance("openai/gpt-oss-20b"),
    ]

    // Cross-provider fallback to Google if Google key is available:
    if (googleApiKey) {
      fallbacks.push(google("gemini-3-flash-preview"))
      fallbacks.push(google("gemini-3.5-flash"))
      fallbacks.push(google("gemini-1.5-flash"))
    }

    return createResilientLanguageModel(primary, fallbacks)
  }

  // 4. Ultimate Fallback to Gemini 3 Flash Preview with fallback chain
  const defaultPrimary = google("gemini-3-flash-preview")
  const defaultFallbacks: LanguageModelV4[] = [
    google("gemini-3.5-flash"),
    google("gemini-2.0-flash"),
    google("gemini-1.5-flash"),
  ]
  return createResilientLanguageModel(defaultPrimary, defaultFallbacks)
}

export function getActiveModelInfo(options?: ModelOptions) {
  if (options?.hasAttachments) {
    return {
      provider: "google (direct multimodal context with fallback)",
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
    const model =
      rawModel.includes("2.5") || rawModel.includes("gpt-oss") || rawModel.includes("/")
        ? "gemini-3-flash-preview"
        : rawModel
    return {
      provider: "google (multi-tier resilient fallback)",
      model,
      hasKey: Boolean(googleApiKey),
    }
  }

  if (configuredProvider === "groq" || groqApiKey) {
    const rawModel = resolveEnvKey("AI_MODEL") || process.env.AI_MODEL || "qwen/qwen3.8-27b"
    const model = rawModel.includes("gpt-oss") || rawModel.includes("2.5") ? "qwen/qwen3.8-27b" : rawModel
    return {
      provider: "groq (multi-tier resilient fallback)",
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

