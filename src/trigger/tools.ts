import { tool } from "ai"
import { z } from "zod"
import { getDaytona } from "../../lib/daytona"

export type ToolErrorType =
  | "VALIDATION_ERROR"
  | "COMMAND_REJECTED"
  | "TIMEOUT"
  | "EXECUTION_ERROR"

export interface ToolFailureResponse {
  success: false
  error_type: ToolErrorType
  details: string
  instruction: string
}

export function createToolFailure(
  error_type: ToolErrorType,
  details: string,
  instruction: string
): ToolFailureResponse {
  return {
    success: false,
    error_type,
    details,
    instruction,
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`TIMEOUT:${errorMessage}`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim()
}

// Regex patterns for blacklisted dangerous commands in bash
const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:^|[;&|`$()]\s*)rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*|-r\s+-f|-f\s+-r)\s+(?:\/|\/\*|~\/|~|\$HOME|\.\.|\/\.\.)(?:\s|[;&|]|$)/i,
    reason: "Destructive root/home recursive deletion is strictly prohibited.",
  },
  {
    pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "Fork bombs and resource-exhaustion commands are prohibited.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:>|>>|tee|sed|chmod|chown|rm)\s+.*\/etc\/(?:passwd|shadow|sudoers|pam\.d)/i,
    reason: "Modifying critical operating system authentication files (/etc/passwd, shadow, sudoers) is prohibited.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:mkfs|fdisk|dd\s+.*of=\/dev\/(?:sd[a-z]|nvme|hd[a-z]|null|zero)|rm\s+.*\/boot)/i,
    reason: "Disk reformatting, raw partition writes, and altering /boot are prohibited.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:shutdown|reboot|poweroff|init\s+[06])(?:\s|[;&|]|$)/i,
    reason: "System shutdown and reboot commands are disabled in this environment.",
  },
]

function checkCommandSafety(command: string): { safe: boolean; reason?: string } {
  for (const item of DANGEROUS_COMMAND_PATTERNS) {
    if (item.pattern.test(command)) {
      return { safe: false, reason: item.reason }
    }
  }
  return { safe: true }
}

const RESTRICTED_WRITE_DIRECTORIES = [
  "/etc",
  "/boot",
  "/dev",
  "/proc",
  "/sys",
  "/usr",
  "/lib",
  "/bin",
  "/sbin",
]

function checkPathWriteSafety(targetPath: string): { safe: boolean; reason?: string } {
  const normalized = targetPath.replace(/\\/g, "/").trim()
  if (normalized.includes("../") || normalized.includes("/..") || normalized === "..") {
    return {
      safe: false,
      reason: "Path traversal via '..' is not permitted. Write files inside '/workspace', '/tmp', or relative paths without parent traversal.",
    }
  }

  for (const prefix of RESTRICTED_WRITE_DIRECTORIES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return {
        safe: false,
        reason: `Writing to system directory "${normalized}" is prohibited. Write files to '/workspace' or '/tmp'.`,
      }
    }
  }

  return { safe: true }
}

function checkPathReadSafety(targetPath: string): { safe: boolean; reason?: string } {
  const normalized = targetPath.replace(/\\/g, "/").trim()
  if (
    normalized === "/etc/shadow" ||
    normalized.startsWith("/etc/shadow") ||
    normalized === "/etc/sudoers" ||
    normalized.startsWith("/etc/sudoers") ||
    normalized.startsWith("/dev/") ||
    normalized.startsWith("/proc/kcore")
  ) {
    return {
      safe: false,
      reason: `Reading sensitive system authentication file "${normalized}" is prohibited.`,
    }
  }
  return { safe: true }
}

const KNOWN_SPECIAL_KEYS = new Set([
  "enter", "return", "tab", "escape", "esc", "backspace", "delete", "del",
  "space", "up", "down", "left", "right", "arrowup", "arrowdown", "arrowleft", "arrowright",
  "pageup", "pagedown", "home", "end", "insert", "capslock", "numlock",
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
  "ctrl", "shift", "alt", "super", "meta", "win", "cmd",
])

function isKeyValid(keyStr: string): boolean {
  const normalized = keyStr.trim().toLowerCase()
  if (KNOWN_SPECIAL_KEYS.has(normalized)) return true
  if (normalized.includes("+")) {
    const parts = normalized.split("+")
    return parts.every((p) => p.length === 1 || KNOWN_SPECIAL_KEYS.has(p))
  }
  return normalized.length === 1
}

export interface BotTeammate {
  id: string
  name: string
  job: string
  instructions?: string | null
}

export interface DaytonaToolContext {
  sandboxId?: string
  botId?: string
  botName?: string
  isGroup?: boolean
  chatName?: string
  groupMembers?: BotTeammate[]
}

export const NATIVE_DISPLAY_WIDTH = 1920
export const NATIVE_DISPLAY_HEIGHT = 1080
export const OPTIMIZED_DISPLAY_WIDTH = 1024
export const OPTIMIZED_DISPLAY_HEIGHT = 768

/**
 * Deterministic mapping utility to translate coordinates between downscaled/optimized
 * frame dimensions (1024x768) and the native X11 display resolution (1920x1080).
 */
export function normalizeCoordinates(
  x: number,
  y: number,
  sourceWidth = OPTIMIZED_DISPLAY_WIDTH,
  sourceHeight = OPTIMIZED_DISPLAY_HEIGHT
): { x: number; y: number } {
  // If coordinates already exceed optimized dimensions, clamp to native 1920x1080
  if (x > sourceWidth || y > sourceHeight) {
    return {
      x: Math.max(0, Math.min(NATIVE_DISPLAY_WIDTH, Math.round(x))),
      y: Math.max(0, Math.min(NATIVE_DISPLAY_HEIGHT, Math.round(y))),
    }
  }
  // Proportionally scale to native X11 coordinates
  const mappedX = Math.round((x / sourceWidth) * NATIVE_DISPLAY_WIDTH)
  const mappedY = Math.round((y / sourceHeight) * NATIVE_DISPLAY_HEIGHT)
  return {
    x: Math.max(0, Math.min(NATIVE_DISPLAY_WIDTH, mappedX)),
    y: Math.max(0, Math.min(NATIVE_DISPLAY_HEIGHT, mappedY)),
  }
}

/**
 * Downscale full-resolution desktop screenshot (1920x1080) to 1024x768 and compress
 * using JPEG to minimize payload size by up to 90%.
 */
export async function optimizeScreenshot(base64Png: string): Promise<{
  screenshot: string
  mediaType: string
  width: number
  height: number
  sizeBytes: number
}> {
  try {
    const sharp = (await import("sharp")).default
    const inputBuffer = Buffer.from(base64Png, "base64")
    const optimizedBuffer = await sharp(inputBuffer)
      .resize(OPTIMIZED_DISPLAY_WIDTH, OPTIMIZED_DISPLAY_HEIGHT, { fit: "inside" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()

    return {
      screenshot: optimizedBuffer.toString("base64"),
      mediaType: "image/jpeg",
      width: OPTIMIZED_DISPLAY_WIDTH,
      height: OPTIMIZED_DISPLAY_HEIGHT,
      sizeBytes: optimizedBuffer.length,
    }
  } catch {
    const buf = Buffer.from(base64Png, "base64")
    return {
      screenshot: base64Png,
      mediaType: "image/png",
      width: NATIVE_DISPLAY_WIDTH,
      height: NATIVE_DISPLAY_HEIGHT,
      sizeBytes: buf.length,
    }
  }
}

export function createDaytonaTools(context?: DaytonaToolContext) {
  const getSandbox = async () => {
    const sandboxId = context?.sandboxId
    if (!sandboxId) {
      throw new Error(
        "No sandbox environment attached to this bot. Sandbox ID is missing."
      )
    }
    const daytona = getDaytona()
    const sandbox = await daytona.get(sandboxId)
    if (!sandbox) {
      throw new Error(`Daytona sandbox with ID ${sandboxId} not found.`)
    }
    if (sandbox.state && sandbox.state !== "started") {
      try {
        await sandbox.start()
      } catch {
        // ignore if already starting or running
      }
    }
    return sandbox
  }

  const ensureComputerUse = async (sandbox: any) => {
    try {
      const status = await sandbox.computerUse.getStatus()
      if (status?.status !== "running") {
        await sandbox.computerUse.start()
      }
    } catch {
      try {
        await sandbox.computerUse.start()
      } catch {
        // ignore if already started
      }
    }
  }

  return {
    webSearch: tool({
      description:
        "Search the web for up-to-date information, news, vehicle/product reviews, recommendations, documentation, or facts. Provide query keywords. Returns top search results with titles, snippets, and source URLs.",
      inputSchema: z.object({
        query: z.string().min(1, "Query cannot be empty").max(500, "Query exceeds 500 characters").describe("Search keywords or query"),
      }),
      execute: async ({ query }) => {
        try {
          return await withTimeout(
            (async () => {
              // 1. Fast DuckDuckGo HTML Search via GET (sub-second latency & full web coverage)
              try {
                const encodedQuery = encodeURIComponent(query.trim())
                const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
                  method: "GET",
                  signal: AbortSignal.timeout(5000),
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                  },
                })

                if (ddgRes.ok) {
                  const html = await ddgRes.text()
                  const results: Array<{ title: string; url: string; snippet: string }> = []
                  const blocks = html.split('class="result ')

                  for (const block of blocks.slice(1)) {
                    const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
                    const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)

                    if (titleMatch) {
                      let rawUrl = titleMatch[1]
                      // Decode direct destination from DuckDuckGo redirect
                      const uddgMatch = rawUrl.match(/uddg=([^&]+)/)
                      if (uddgMatch) {
                        try {
                          rawUrl = decodeURIComponent(uddgMatch[1])
                        } catch {}
                      }

                      const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, "").trim())
                      let snippet = snippetMatch
                        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, "").trim())
                        : ""
                      if (snippet.length > 200) {
                        snippet = snippet.slice(0, 197) + "..."
                      }

                      if (title && rawUrl.startsWith("http")) {
                        results.push({ title, url: rawUrl, snippet })
                      }
                    }
                  }

                  if (results.length > 0) {
                    return {
                      success: true,
                      query,
                      count: Math.min(results.length, 5),
                      results: results.slice(0, 5),
                    }
                  }
                }
              } catch {
                // Proceed to high-speed fallbacks
              }

              // 2. DuckDuckGo Instant Answer API (Ultra-fast, ~300ms)
              try {
                const instantRes = await fetch(
                  `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
                  { signal: AbortSignal.timeout(3500) }
                )
                if (instantRes.ok) {
                  const data = await instantRes.json()
                  const results: Array<{ title: string; url: string; snippet: string }> = []
                  if (data.Abstract && data.AbstractURL) {
                    results.push({
                      title: data.Heading || query,
                      url: data.AbstractURL,
                      snippet: data.Abstract.slice(0, 200),
                    })
                  }
                  if (Array.isArray(data.RelatedTopics)) {
                    for (const topic of data.RelatedTopics.slice(0, 4)) {
                      if (topic.Text && topic.FirstURL) {
                        results.push({
                          title: topic.Text.slice(0, 60),
                          url: topic.FirstURL,
                          snippet: topic.Text.slice(0, 180),
                        })
                      }
                    }
                  }
                  if (results.length > 0) {
                    return {
                      success: true,
                      query,
                      count: results.length,
                      results,
                    }
                  }
                }
              } catch {}

              // 3. Fallback to Wikipedia search API
              try {
                const wikiRes = await fetch(
                  `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`,
                  {
                    signal: AbortSignal.timeout(4000),
                    headers: {
                      "User-Agent": "MiraAI/1.0 (https://mira.local; contact@mira.ai)",
                    },
                  }
                )
                if (wikiRes.ok) {
                  const data = await wikiRes.json()
                  const wikiResults = (data?.query?.search || []).map((item: any) => ({
                    title: item.title,
                    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
                    snippet: decodeHtmlEntities(item.snippet || "").slice(0, 180),
                  }))
                  if (wikiResults.length > 0) {
                    return {
                      success: true,
                      query,
                      count: wikiResults.length,
                      results: wikiResults.slice(0, 5),
                    }
                  }
                }
              } catch {}

              return {
                success: true,
                query,
                count: 0,
                results: [],
                message: "No search results found.",
              }
            })(),
            12000,
            "Web search request timed out after 12 seconds."
          )
        } catch (error: any) {
          if (String(error?.message).startsWith("TIMEOUT:")) {
            return createToolFailure(
              "TIMEOUT",
              "Web search timed out.",
              "Try simplifying your search query keywords."
            )
          }

          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Check network connectivity or retry with different keywords."
          )
        }
      },
    }),

    searchImages: tool({
      description:
        "Search for high-resolution images, photos, and links of products, gadgets (e.g. PS5, iPhone, GPU), places, cars, movies, celebrities, animals, or topics. Returns image URLs, titles, and sources. Always use this tool when the user asks about a subject or asks to see photos/images/links, so you can display them via markdown `![Title](imageUrl)` and `[Title](sourceUrl)`.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1, "Query cannot be empty")
          .max(500, "Query exceeds 500 characters")
          .describe(
            "Topic or product to search images for, e.g. 'PlayStation 5 console', 'Ferrari SF90', 'Eiffel Tower'"
          ),
      }),
      execute: async ({ query }) => {
        try {
          return await withTimeout(
            (async () => {
              const images: Array<{
                title: string
                imageUrl: string
                sourceUrl: string
                description?: string
              }> = []
              const seenUrls = new Set<string>()

              // Parallel search across Wikipedia PageImages & Wikimedia Commons for minimal latency
              const [wikiResult, commonsResult] = await Promise.allSettled([
                fetch(
                  `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
                    query
                  )}&gsrlimit=6&prop=pageimages|info&piprop=thumbnail|original&pithumbsize=960&inprop=url&format=json`,
                  {
                    signal: AbortSignal.timeout(6000),
                    headers: {
                      "User-Agent":
                        "MiraAI/1.0 (https://mira.local; contact@mira.ai)",
                    },
                  }
                ).then(async (res) => (res.ok ? res.json() : null)),
                fetch(
                  `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
                    query
                  )}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&format=json`,
                  {
                    signal: AbortSignal.timeout(6000),
                    headers: {
                      "User-Agent":
                        "MiraAI/1.0 (https://mira.local; contact@mira.ai)",
                    },
                  }
                ).then(async (res) => (res.ok ? res.json() : null)),
              ])

              // Process Wikipedia PageImages
              if (wikiResult.status === "fulfilled" && wikiResult.value) {
                const data = wikiResult.value
                const pages = Object.values(data?.query?.pages || {}) as any[]
                for (const page of pages) {
                  const imgUrl =
                    page.thumbnail?.source || page.original?.source
                  if (imgUrl && !seenUrls.has(imgUrl)) {
                    seenUrls.add(imgUrl)
                    images.push({
                      title: page.title || query,
                      imageUrl: imgUrl,
                      sourceUrl:
                        page.fullurl ||
                        `https://en.wikipedia.org/wiki/${encodeURIComponent(
                          (page.title || query).replace(/ /g, "_")
                        )}`,
                      description: page.title,
                    })
                  }
                }
              }

              // Process Wikimedia Commons results
              if (commonsResult.status === "fulfilled" && commonsResult.value) {
                const data = commonsResult.value
                const pages = Object.values(data?.query?.pages || {}) as any[]
                for (const page of pages) {
                  const info = page.imageinfo?.[0]
                  const imgUrl = info?.thumburl || info?.url
                  if (imgUrl && !seenUrls.has(imgUrl)) {
                    if (
                      imgUrl.endsWith(".svg.png") ||
                      /\.(jpe?g|png|webp)/i.test(imgUrl)
                    ) {
                      seenUrls.add(imgUrl)
                      const rawTitle = (page.title || "")
                        .replace(/^File:/i, "")
                        .replace(/\.[^.]+$/, "")
                      images.push({
                        title: rawTitle || query,
                        imageUrl: imgUrl,
                        sourceUrl:
                          info?.descriptionurl ||
                          `https://commons.wikimedia.org/wiki/${encodeURIComponent(
                            page.title
                          )}`,
                        description: rawTitle,
                      })
                    }
                  }
                }
              }

              // 3. Fallback via sandbox python if no images found yet
              if (images.length === 0) {
                try {
                  const sandbox = await getSandbox()
                  const script = `python3 -c "
import urllib.request, urllib.parse, json
query = '''${query.replace(/'/g, "\\'")}'''
url = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + urllib.parse.quote(query) + '&gsrlimit=5&prop=pageimages|info&piprop=thumbnail|original&pithumbsize=960&inprop=url&format=json'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    pages = list(data.get('query', {}).get('pages', {}).values())
    results = []
    for p in pages:
        src = p.get('thumbnail', {}).get('source') or p.get('original', {}).get('source')
        if src:
            results.append({'title': p.get('title', query), 'imageUrl': src, 'sourceUrl': p.get('fullurl', '')})
    print(json.dumps(results))
"`
                  const res = await withTimeout(
                    sandbox.process.executeCommand(script),
                    12000,
                    "Sandbox image search fallback timed out."
                  )
                  if (res.exitCode === 0 && res.result) {
                    const parsed = JSON.parse(res.result.trim())
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      for (const item of parsed) {
                        if (item.imageUrl && !seenUrls.has(item.imageUrl)) {
                          seenUrls.add(item.imageUrl)
                          images.push(item)
                        }
                      }
                    }
                  }
                } catch {}
              }

              if (images.length > 0) {
                return {
                  success: true,
                  query,
                  count: images.length,
                  images: images.slice(0, 6),
                  instruction:
                    "Embed these images in your response using markdown syntax: `![title](imageUrl)` and provide useful source links with `[title](sourceUrl)`.",
                }
              }

              return {
                success: true,
                query,
                count: 0,
                images: [],
                message: `No direct images found for '${query}'. Try broader search terms.`,
              }
            })(),
            20000,
            "Image search timed out after 20 seconds."
          )
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Retry with different search keywords."
          )
        }
      },
    }),

    fetchUrl: tool({
      description:
        "Fetch and extract readable text and content from any webpage URL. Returns the page title and cleaned text content.",
      inputSchema: z.object({
        url: z.string().url("Must be a valid HTTP or HTTPS URL").max(2000, "URL exceeds 2000 character limit").describe("The HTTP or HTTPS URL to fetch"),
      }),
      execute: async ({ url }) => {
        // Block loopback metadata probes
        if (/^(https?:\/\/)?(169\.254\.169\.254|metadata\.google\.internal|127\.0\.0\.1|localhost)/i.test(url)) {
          return createToolFailure(
            "COMMAND_REJECTED",
            "Access to internal cloud metadata or local loopback addresses is restricted.",
            "Provide a public HTTP or HTTPS web URL."
          )
        }

        try {
          return await withTimeout(
            (async () => {
              const res = await fetch(url, {
                signal: AbortSignal.timeout(8000),
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                redirect: "follow",
              })

              if (!res.ok) {
                return createToolFailure(
                  "EXECUTION_ERROR",
                  `HTTP ${res.status}: ${res.statusText}`,
                  "The remote server returned an error. Check the URL or try searching for another source."
                )
              }

              const html = await res.text()
              const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
              const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : ""

              let body = html
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<svg[\s\S]*?<\/svg>/gi, "")
                .replace(/<header[\s\S]*?<\/header>/gi, "")
                .replace(/<footer[\s\S]*?<\/footer>/gi, "")
                .replace(/<nav[\s\S]*?<\/nav>/gi, "")
                .replace(/<br\s*[\/]?>/gi, "\n")
                .replace(/<\/p>/gi, "\n\n")
                .replace(/<\/h[1-6]>/gi, "\n\n")
                .replace(/<\/li>/gi, "\n")
                .replace(/<[^>]+>/g, " ")

              body = decodeHtmlEntities(body)
                .replace(/[ \t]+/g, " ")
                .replace(/\n\s*\n\s*\n+/g, "\n\n")
                .trim()

              return {
                success: true,
                url,
                title,
                content: body.slice(0, 6000),
              }
            })(),
            20000,
            "Fetching URL timed out after 20 seconds."
          )
        } catch (error: any) {
          if (String(error?.message).startsWith("TIMEOUT:")) {
            return createToolFailure(
              "TIMEOUT",
              "URL fetch timed out after 20 seconds.",
              "The remote web server was too slow to respond. Try an alternative URL."
            )
          }

          // Fallback via sandbox curl
          try {
            const sandbox = await getSandbox()
            const cmd = `curl -sL -m 15 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}" | sed -e 's/<script[^>]*>.*<\\/script>//gi' -e 's/<[^>]*>/ /g' | tr -s ' ' | head -c 5000`
            const res = await withTimeout(
              sandbox.process.executeCommand(cmd),
              15000,
              "Sandbox curl fallback timed out."
            )
            if (res.exitCode === 0 && res.result) {
              return {
                success: true,
                url,
                content: res.result.trim(),
              }
            }
          } catch {}

          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Could not fetch the URL. Check whether the domain is reachable."
          )
        }
      },
    }),

    bash: tool({
      description:
        "Run a bash or shell command in the sandbox terminal. Returns standard output and exit code.",
      inputSchema: z.object({
        command: z.string().min(1, "Command must not be empty").max(4000, "Command exceeds 4000 characters limit").describe("The shell command to execute"),
      }),
      execute: async ({ command }) => {
        // 1. Guardrail check for dangerous command patterns
        const safety = checkCommandSafety(command)
        if (!safety.safe) {
          return createToolFailure(
            "COMMAND_REJECTED",
            safety.reason || "Forbidden command pattern detected.",
            "Your command was rejected by guardrails. Avoid destructive root deletion (rm -rf /), fork bombs, or modifying /etc/passwd/sudoers. Target safe directories in /workspace or /tmp."
          )
        }

        try {
          const sandbox = await getSandbox()
          // 2. Enforce maximum 30 seconds execution timeout failsafe
          const res = await withTimeout(
            sandbox.process.executeCommand(command),
            30000,
            "Execution exceeded the 30-second time limit."
          )
          return {
            success: true,
            stdout: res.result,
            exitCode: res.exitCode,
          }
        } catch (error: any) {
          if (String(error?.message).startsWith("TIMEOUT:")) {
            return createToolFailure(
              "TIMEOUT",
              "Command execution timed out after 30 seconds. The process was aborted.",
              "The command timed out, possibly waiting for interactive input or running a long loop. If installing packages, always pass non-interactive flags like '-y' (e.g. 'DEBIAN_FRONTEND=noninteractive apt-get install -y <pkg>') or run background processes with '&'."
            )
          }

          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Inspect the error output, verify command syntax and file existence, and retry."
          )
        }
      },
    }),

    readFile: tool({
      description:
        "Read the contents of a file at the specified path in the sandbox filesystem.",
      inputSchema: z.object({
        path: z.string().min(1, "Path cannot be empty").describe("Path to the file to read"),
      }),
      execute: async ({ path }) => {
        // Guardrail: check reading restricted files
        const safety = checkPathReadSafety(path)
        if (!safety.safe) {
          return createToolFailure(
            "COMMAND_REJECTED",
            safety.reason || "Reading restricted system file.",
            "Read files within '/workspace', '/tmp', or standard project directories."
          )
        }

        try {
          const sandbox = await getSandbox()
          const buffer = await withTimeout(
            sandbox.fs.downloadFile(path),
            20000,
            "File download timed out after 20 seconds."
          )
          return {
            success: true,
            path,
            content: buffer.toString("utf-8"),
          }
        } catch (error: any) {
          if (String(error?.message).startsWith("TIMEOUT:")) {
            return createToolFailure(
              "TIMEOUT",
              `Reading file at "${path}" timed out.`,
              "Check if the filesystem is responsive or the file is excessively large."
            )
          }
          return createToolFailure(
            "EXECUTION_ERROR",
            `Failed to read file at "${path}": ${error?.message || String(error)}`,
            "Check whether the file path exists or call 'listFiles' to inspect the directory."
          )
        }
      },
    }),

    writeFile: tool({
      description:
        "Write or overwrite content to a file at the specified path in the sandbox filesystem. Limited to 2MB per write.",
      inputSchema: z.object({
        path: z.string().min(1, "Path cannot be empty").describe("Path to the file to write"),
        content: z.string().describe("The text content to write into the file"),
      }),
      execute: async ({ path, content }) => {
        // 1. Enforce payload size boundary (max 2MB)
        const bytes = Buffer.byteLength(content, "utf-8")
        if (bytes > 2 * 1024 * 1024) {
          return createToolFailure(
            "VALIDATION_ERROR",
            `File content size (${(bytes / 1024 / 1024).toFixed(2)}MB) exceeds the 2MB limit.`,
            "Reduce the content size or write the file incrementally using a Python/bash script."
          )
        }

        // 2. Enforce path traversal & system directory protection
        const safety = checkPathWriteSafety(path)
        if (!safety.safe) {
          return createToolFailure(
            "COMMAND_REJECTED",
            safety.reason || "Writing to restricted system directory.",
            "Ensure you write files within '/workspace', '/tmp', or relative project paths."
          )
        }

        try {
          const sandbox = await getSandbox()
          await withTimeout(
            sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), path),
            25000,
            "Writing file timed out after 25 seconds."
          )
          return {
            success: true,
            path,
            bytesWritten: bytes,
          }
        } catch (error: any) {
          if (String(error?.message).startsWith("TIMEOUT:")) {
            return createToolFailure(
              "TIMEOUT",
              `Writing file to "${path}" timed out.`,
              "Ensure the filesystem is available and the destination directory exists."
            )
          }
          return createToolFailure(
            "EXECUTION_ERROR",
            `Failed to write file to "${path}": ${error?.message || String(error)}`,
            "Check if the parent directory exists or create it using bash 'mkdir -p <dir>' first."
          )
        }
      },
    }),

    listFiles: tool({
      description:
        "List files and directories at the specified path in the sandbox filesystem.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .default(".")
          .describe(
            "Directory path to list (defaults to current working directory)"
          ),
      }),
      execute: async ({ path = "." }) => {
        const normalized = path.replace(/\\/g, "/").trim()
        if (normalized.includes("../") || normalized.includes("/..")) {
          return createToolFailure(
            "COMMAND_REJECTED",
            "Path traversal via '..' is forbidden.",
            "Specify a directory path within '/workspace', '/tmp', or '.' without parent traversal."
          )
        }

        try {
          const sandbox = await getSandbox()
          const files = await withTimeout(
            sandbox.fs.listFiles(path),
            20000,
            "Listing files timed out after 20 seconds."
          )
          return {
            success: true,
            path,
            files: files.map((f) => ({
              name: f.name,
              isDir: f.isDir,
              size: f.size,
              modTime: f.modTime,
            })),
          }
        } catch (error: any) {
          if (String(error?.message).startsWith("TIMEOUT:")) {
            return createToolFailure(
              "TIMEOUT",
              `Listing files at "${path}" timed out.`,
              "Verify the path is responsive."
            )
          }
          return createToolFailure(
            "EXECUTION_ERROR",
            `Failed to list files at "${path}": ${error?.message || String(error)}`,
            "Check that the directory exists or try listing '.'."
          )
        }
      },
    }),

    mouseClick: tool({
      description:
        "Click the mouse at specified coordinates on the desktop display (0 <= x <= 1920, 0 <= y <= 1080).",
      inputSchema: z.object({
        x: z.number().min(0, "X must be >= 0").max(1920, "X must be <= 1920").describe("The X coordinate to click at (0-1920)"),
        y: z.number().min(0, "Y must be >= 0").max(1080, "Y must be <= 1080").describe("The Y coordinate to click at (0-1080)"),
        button: z
          .enum(["left", "right", "middle"])
          .optional()
          .default("left")
          .describe("Mouse button to click (left, right, middle)"),
        double: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to perform a double click"),
      }),
      execute: async ({ x, y, button = "left", double = false }) => {
        if (x < 0 || x > 1920 || y < 0 || y > 1080) {
          return createToolFailure(
            "VALIDATION_ERROR",
            `Coordinates (${x}, ${y}) are out of screen bounds [0-1920, 0-1080].`,
            "Call 'viewScreen' to inspect the display coordinates and ensure X is 0-1920 and Y is 0-1080."
          )
        }

        const { x: targetX, y: targetY } = normalizeCoordinates(x, y)

        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await withTimeout(
            sandbox.computerUse.mouse.click(targetX, targetY, button, double),
            15000,
            "Mouse click timed out after 15 seconds."
          )
          return {
            success: true,
            x: targetX,
            y: targetY,
            originalX: x,
            originalY: y,
            button,
            double,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure the desktop display server is running."
          )
        }
      },
    }),

    mouseMove: tool({
      description:
        "Move the mouse cursor to specified coordinates on the desktop display (0 <= x <= 1920, 0 <= y <= 1080).",
      inputSchema: z.object({
        x: z.number().min(0, "X must be >= 0").max(1920, "X must be <= 1920").describe("The X coordinate to move to (0-1920)"),
        y: z.number().min(0, "Y must be >= 0").max(1080, "Y must be <= 1080").describe("The Y coordinate to move to (0-1080)"),
      }),
      execute: async ({ x, y }) => {
        if (x < 0 || x > 1920 || y < 0 || y > 1080) {
          return createToolFailure(
            "VALIDATION_ERROR",
            `Coordinates (${x}, ${y}) are out of screen bounds [0-1920, 0-1080].`,
            "Call 'viewScreen' to inspect the display coordinates and ensure X is 0-1920 and Y is 0-1080."
          )
        }

        const { x: targetX, y: targetY } = normalizeCoordinates(x, y)

        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          const res = await withTimeout(
            sandbox.computerUse.mouse.move(targetX, targetY),
            15000,
            "Mouse move timed out after 15 seconds."
          )
          return {
            success: true,
            x: res.x,
            y: res.y,
            originalX: x,
            originalY: y,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure the desktop display server is running."
          )
        }
      },
    }),

    mouseScroll: tool({
      description:
        "Scroll the mouse wheel at specified coordinates on the desktop display (0 <= x <= 1920, 0 <= y <= 1080).",
      inputSchema: z.object({
        x: z.number().min(0, "X must be >= 0").max(1920, "X must be <= 1920").describe("The X coordinate to scroll at (0-1920)"),
        y: z.number().min(0, "Y must be >= 0").max(1080, "Y must be <= 1080").describe("The Y coordinate to scroll at (0-1080)"),
        direction: z
          .enum(["up", "down"])
          .describe("Scroll direction ('up' or 'down')"),
        amount: z
          .number()
          .min(1, "Amount must be >= 1")
          .max(100, "Amount must be <= 100")
          .optional()
          .default(1)
          .describe("Number of scroll clicks/steps"),
      }),
      execute: async ({ x, y, direction, amount = 1 }) => {
        if (x < 0 || x > 1920 || y < 0 || y > 1080) {
          return createToolFailure(
            "VALIDATION_ERROR",
            `Coordinates (${x}, ${y}) are out of screen bounds [0-1920, 0-1080].`,
            "Ensure coordinates are within 0-1920 for X and 0-1080 for Y."
          )
        }

        const { x: targetX, y: targetY } = normalizeCoordinates(x, y)

        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await withTimeout(
            sandbox.computerUse.mouse.scroll(targetX, targetY, direction, amount),
            15000,
            "Mouse scroll timed out after 15 seconds."
          )
          return {
            success: true,
            x: targetX,
            y: targetY,
            originalX: x,
            originalY: y,
            direction,
            amount,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure the desktop display server is running."
          )
        }
      },
    }),

    keyboardType: tool({
      description:
        "Type text using the keyboard in the active window on the desktop display. Limited to 5000 characters per call.",
      inputSchema: z.object({
        text: z.string().min(1, "Text must not be empty").max(5000, "Text exceeds 5000 characters limit").describe("The text string to type"),
        delay: z
          .number()
          .min(0, "Delay must be >= 0")
          .max(5000, "Delay must be <= 5000ms")
          .optional()
          .describe("Optional delay between keystrokes in milliseconds"),
      }),
      execute: async ({ text, delay }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await withTimeout(
            sandbox.computerUse.keyboard.type(text, delay),
            20000,
            "Keyboard typing timed out after 20 seconds."
          )
          return {
            success: true,
            charactersTyped: text.length,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure a GUI window is currently focused on the desktop."
          )
        }
      },
    }),

    keyboardPress: tool({
      description:
        "Press a specific keyboard key or key combination (e.g. 'enter', 'tab', 'escape', 'c' with ['ctrl'], 'alt+tab').",
      inputSchema: z.object({
        key: z
          .string()
          .min(1, "Key cannot be empty")
          .describe(
            "Key name to press (e.g., 'enter', 'tab', 'escape', 'c', or hotkey combo like 'ctrl+c')"
          ),
        modifiers: z
          .array(z.enum(["ctrl", "shift", "alt", "meta", "super"]))
          .optional()
          .describe("List of modifier keys (e.g., ['ctrl', 'shift', 'alt'])"),
      }),
      execute: async ({ key, modifiers }) => {
        // Guardrail: validate key format
        if (!isKeyValid(key)) {
          return createToolFailure(
            "VALIDATION_ERROR",
            `Invalid key "${key}". Key must be a valid alphanumeric character, known key name (e.g. 'enter', 'tab', 'escape', 'space'), or combo like 'ctrl+c'.`,
            "Check the key parameter and pass a standard key name or key combination."
          )
        }

        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          await withTimeout(
            (async () => {
              if (key.includes("+") && (!modifiers || modifiers.length === 0)) {
                await sandbox.computerUse.keyboard.hotkey(key)
              } else {
                await sandbox.computerUse.keyboard.press(key, modifiers)
              }
            })(),
            15000,
            "Keyboard press timed out after 15 seconds."
          )
          return {
            success: true,
            key,
            modifiers: modifiers || [],
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure the desktop display server is running."
          )
        }
      },
    }),

    viewScreen: tool({
      description:
        "Capture and view the current desktop screen in the sandbox so you can inspect what is visible on display. Use this to examine applications, check outputs, or decide your next UI action. This screenshot is for your internal inspection and is NEVER rendered in chat.",
      inputSchema: z.object({
        showCursor: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Whether to include the mouse cursor in the captured screenshot"
          ),
      }),
      execute: async ({ showCursor = false }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          const res = await withTimeout(
            sandbox.computerUse.screenshot.takeFullScreen(showCursor),
            20000,
            "Screen capture timed out after 20 seconds."
          )
          if (!res.screenshot) {
            throw new Error("No screenshot data received from display capture.")
          }
          const optimized = await optimizeScreenshot(res.screenshot)
          return {
            success: true,
            screenshot: optimized.screenshot,
            mediaType: optimized.mediaType,
            width: optimized.width,
            height: optimized.height,
            sizeBytes: optimized.sizeBytes,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Check that the display server on DISPLAY=:0 is active."
          )
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (output?.success === false) {
          return {
            type: "text",
            value: `[TOOL_FAILURE: ${output.error_type}]\nDetails: ${output.details}\nInstruction: ${output.instruction}`,
          }
        }
        if (output?.screenshot) {
          return {
            type: "content",
            value: [
              {
                type: "file",
                mediaType: output.mediaType || "image/jpeg",
                data: { type: "data", data: output.screenshot },
              },
              {
                type: "text",
                text: "Desktop screen screenshot captured (optimized 1024x768). Inspect the active display and continue your task.",
              },
            ],
          }
        }
        return {
          type: "text",
          value: output?.error
            ? `Failed to view screen: ${output.error}`
            : "Failed to capture screen",
        }
      },
    }),

    showScreen: tool({
      description:
        "Capture the current desktop screen and display it directly to the user in chat. Call this when the user asks what is on the screen, wants a screenshot, or requests to see what is currently open.",
      inputSchema: z.object({
        showCursor: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Whether to include the mouse cursor in the screenshot. Defaults to true."
          ),
      }),
      execute: async ({ showCursor = true }) => {
        try {
          const sandbox = await getSandbox()
          await ensureComputerUse(sandbox)
          const res = await withTimeout(
            sandbox.computerUse.screenshot.takeFullScreen(showCursor),
            20000,
            "Screen capture timed out after 20 seconds."
          )
          if (!res.screenshot) {
            throw new Error("No screenshot data received from display capture.")
          }
          const optimized = await optimizeScreenshot(res.screenshot)
          return {
            success: true,
            screenshot: optimized.screenshot,
            mediaType: optimized.mediaType,
            width: optimized.width,
            height: optimized.height,
            sizeBytes: optimized.sizeBytes,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Check that the display server on DISPLAY=:0 is active."
          )
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (output?.success === false) {
          return {
            type: "text",
            value: `[TOOL_FAILURE: ${output.error_type}]\nDetails: ${output.details}\nInstruction: ${output.instruction}`,
          }
        }
        return {
          type: "text",
          value: output?.success
            ? "Screenshot captured and rendered in chat for the user."
            : `Failed to show screen: ${output?.error}`,
        }
      },
    }),

    handoff: tool({
      description:
        "Hand off or transfer the user request to another AI teammate in this group chat if their role, skills, or expertise are better suited for the user's prompt.",
      inputSchema: z.object({
        targetBotId: z
          .string()
          .optional()
          .describe("The ID of the teammate bot to hand off to (if known)."),
        targetBotName: z
          .string()
          .min(1, "targetBotName cannot be empty")
          .describe(
            "The exact name of the teammate bot in the group chat to hand off to."
          ),
        reason: z
          .string()
          .min(1, "reason cannot be empty")
          .describe(
            "Clear explanation of why this teammate is better suited for the user's request."
          ),
        contextMessage: z
          .string()
          .optional()
          .describe(
            "A summary of what the user needs or specific instructions/context for the teammate."
          ),
      }),
      execute: async ({ targetBotId, targetBotName, reason, contextMessage }) => {
        const members = context?.groupMembers || []
        const currentBotId = context?.botId
        const currentBotName = context?.botName?.toLowerCase()

        // Filter out current bot
        const availableTeammates = members.filter((m) => {
          if (currentBotId && m.id === currentBotId) return false
          if (currentBotName && m.name.toLowerCase() === currentBotName) return false
          return true
        })

        if (!context?.isGroup && availableTeammates.length === 0) {
          return createToolFailure(
            "VALIDATION_ERROR",
            "Handoff is only available in multi-agent group chats with other teammates.",
            "You are in a direct 1:1 conversation. Address the user's request directly without calling handoff."
          )
        }

        // Match target bot by id or name
        const targetBot = availableTeammates.find(
          (m) =>
            (targetBotId && m.id === targetBotId) ||
            m.name.toLowerCase() === targetBotName.toLowerCase() ||
            m.name.toLowerCase().includes(targetBotName.toLowerCase()) ||
            targetBotName.toLowerCase().includes(m.name.toLowerCase())
        )

        if (!targetBot) {
          const list = availableTeammates
            .map((m) => `${m.name} (${m.job})`)
            .join(", ")
          return createToolFailure(
            "VALIDATION_ERROR",
            `Teammate "${targetBotName}" not found in this group chat. Available teammates: ${list || "none"}.`,
            "Select one of the available teammates listed above and call handoff with their exact name."
          )
        }

        return {
          success: true,
          handedOff: true,
          fromBot: {
            id: context?.botId,
            name: context?.botName,
          },
          targetBot: {
            id: targetBot.id,
            name: targetBot.name,
            job: targetBot.job,
          },
          reason,
          contextMessage: contextMessage || null,
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (output?.success === false) {
          return {
            type: "text",
            value: `[TOOL_FAILURE: ${output.error_type}]\nDetails: ${output.details}\nInstruction: ${output.instruction}`,
          }
        }
        return {
          type: "text",
          value: `Handoff initiated successfully to ${output.targetBot.name} (${output.targetBot.job}). Reason: ${output.reason}. Now write your response to the user: politely explain that you are handing this over to ${output.targetBot.name} because their skills/role match this request, and let the user know they can continue with ${output.targetBot.name}.`,
        }
      },
    }),

    getMemory: tool({
      description:
        "Retrieve the bot's persistent memory file (MEMORY.md) from the sandbox. Use this to recall personal notes, user secrets, facts, project details, or preferences shared in past or 1:1 direct conversations.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const sandbox = await getSandbox()
          try {
            const buffer = await withTimeout(
              sandbox.fs.downloadFile("MEMORY.md"),
              15000,
              "Downloading MEMORY.md timed out after 15 seconds."
            )
            const memory = buffer.toString("utf-8")
            return {
              success: true,
              memory,
            }
          } catch {
            const initial = "# MEMORY\n\n"
            try {
              await sandbox.fs.uploadFile(
                Buffer.from(initial, "utf-8"),
                "MEMORY.md"
              )
            } catch {}
            return {
              success: true,
              memory: initial,
            }
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure the sandbox environment is started."
          )
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (output?.success === false) {
          return {
            type: "text",
            value: `[TOOL_FAILURE: ${output.error_type}]\nDetails: ${output.details}\nInstruction: ${output.instruction}`,
          }
        }
        return {
          type: "text",
          value: output.memory ? output.memory : "(Memory is currently empty.)",
        }
      },
    }),

    setMemory: tool({
      description:
        "Save, update, or append information to the bot's persistent memory file (MEMORY.md) in the sandbox. ALWAYS call this tool whenever the user tells you a secret, preference, personal detail, project context, or asks you to remember something so that you can remember it forever across 1:1 and group chats.",
      inputSchema: z.object({
        content: z
          .string()
          .min(1, "Memory content cannot be empty")
          .max(50000, "Memory content exceeds 50KB limit")
          .describe(
            "The information, secret, fact, note, or preference to record into memory."
          ),
        mode: z
          .enum(["append", "replace"])
          .default("append")
          .describe(
            "Whether to append to the existing memory or replace it entirely. Defaults to 'append'."
          ),
      }),
      execute: async ({ content, mode = "append" }) => {
        try {
          const sandbox = await getSandbox()
          let existing = ""
          try {
            const buffer = await withTimeout(
              sandbox.fs.downloadFile("MEMORY.md"),
              15000,
              "Downloading existing memory timed out."
            )
            existing = buffer.toString("utf-8")
          } catch {
            existing = "# MEMORY\n\n"
          }

          let newContent = ""
          if (mode === "replace") {
            newContent = content.trim() ? `${content.trim()}\n` : "# MEMORY\n\n"
          } else {
            const trimmedExisting = existing.trim()
            const timestamp = new Date().toISOString().split("T")[0]
            const entry = `- [${timestamp}] ${content.trim()}`
            newContent = trimmedExisting
              ? `${trimmedExisting}\n${entry}\n`
              : `# MEMORY\n\n${entry}\n`
          }

          await withTimeout(
            sandbox.fs.uploadFile(Buffer.from(newContent, "utf-8"), "MEMORY.md"),
            15000,
            "Uploading updated MEMORY.md timed out."
          )

          return {
            success: true,
            updatedMemory: newContent,
          }
        } catch (error: any) {
          return createToolFailure(
            "EXECUTION_ERROR",
            error?.message || String(error),
            "Ensure the sandbox environment is started."
          )
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (output?.success === false) {
          return {
            type: "text",
            value: `[TOOL_FAILURE: ${output.error_type}]\nDetails: ${output.details}\nInstruction: ${output.instruction}`,
          }
        }
        return {
          type: "text",
          value:
            "Memory updated successfully in MEMORY.md. You will remember this across 1:1 and group chats.",
        }
      },
    }),
  }
}

export type DaytonaTools = ReturnType<typeof createDaytonaTools>
