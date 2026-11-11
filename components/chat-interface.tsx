"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  PromptInputButton,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import {
  Terminal,
  TerminalHeader,
  TerminalTitle,
  TerminalActions,
  TerminalCopyButton,
  TerminalContent,
} from "@/components/ai-elements/terminal"
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning"
import { VoiceDictation } from "@/components/voice-dictation"
import {
  Terminal as TerminalIcon,
  FileText,
  FileCode2,
  FolderCode,
  MousePointerClick,
  MousePointer,
  ArrowUpDown,
  ArrowRightLeft,
  Keyboard,
  MonitorDot,
  Monitor,
  Download,
  BrainCircuit,
  Database,
  Paperclip,
  Paperclip as PaperclipIcon,
  File,
  X,
  Globe,
  Search,
  Plus,
  Image as ImageIcon,
  Sparkles,
  FileUp,
  Command,
  ExternalLink,
  Cpu,
  AlertCircle,
  RotateCcw,
  ArrowUp,
  ChevronDown,
  Square,
  CheckCircle2,
} from "lucide-react"
import { ChatAvatar } from "@/components/chat-avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ChatProps {
  chatId: string
  bot?: {
    id?: string | null
    name?: string | null
    avatar?: string | null
    job?: string | null
    instructions?: string | null
    sandboxId?: string | null
  } | null
  chat?: {
    id: string
    kind: "direct" | "group"
    name?: string | null
  } | null
  bots?: Array<{
    id: string
    name: string
    avatar?: string | null
    job: string
    instructions?: string | null
    sandboxId?: string | null
  }>
  initialMessages?: UIMessage[]
}

export function ChatInterface({
  chatId,
  bot,
  chat,
  bots = [],
  initialMessages = [],
}: ChatProps) {
  const memberBots = React.useMemo(() => {
    if (bots && bots.length > 0) return bots
    if (bot) return [bot as any]
    return []
  }, [bots, bot])

  const isGroup = chat?.kind === "group" || memberBots.length > 1

  const [selectedBotId, setSelectedBotId] = React.useState<string>(() => {
    return memberBots[0]?.id ?? bot?.id ?? ""
  })

  const selectedBot = React.useMemo(() => {
    return memberBots.find((b) => b.id === selectedBotId) ?? memberBots[0] ?? bot
  }, [memberBots, selectedBotId, bot])

  const clientData = React.useMemo(
    () => ({
      botId: selectedBot?.id ?? "",
      botName: selectedBot?.name ?? "AI Teammate",
      botJob: selectedBot?.job ?? "AI Assistant",
      botInstructions: selectedBot?.instructions ?? "",
      sandboxId: selectedBot?.sandboxId ?? "",
      isGroup,
      chatName: chat?.name ?? (isGroup ? "Group Chat" : undefined),
      groupMembers: memberBots.map((b) => ({
        id: b.id,
        name: b.name,
        job: b.job,
        instructions: b.instructions ?? undefined,
      })),
    }),
    [selectedBot, isGroup, chat, memberBots]
  )

  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: {
        chatId,
        clientData,
      },
    })
  }, [chatId, clientData])

  return (
    <ChatView
      chatId={chatId}
      bot={selectedBot}
      chat={chat}
      bots={memberBots}
      isGroup={isGroup}
      selectedBotId={selectedBotId}
      onSelectBot={setSelectedBotId}
      transport={transport}
      initialMessages={initialMessages}
    />
  )
}

function AttachmentChip({
  name,
  contentType,
  url,
  onRemove,
}: {
  id?: string
  name: string
  contentType?: string
  url?: string
  onRemove: () => void
}) {
  const isPdf =
    contentType === "application/pdf" || name.toLowerCase().endsWith(".pdf")
  const isImage = contentType?.startsWith("image/")
  const isCode = /\.(ts|js|py|json|csv|md|txt|sh)$/i.test(name)

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 hover:bg-background px-2.5 py-1 text-xs text-foreground shadow-2xs group shrink-0 transition-all hover:border-cyan-500/50">
      <div className="shrink-0">
        {isImage && url ? (
          <img
            src={url}
            alt={name}
            className="size-5 rounded-md object-cover border border-border/60"
          />
        ) : isPdf ? (
          <div className="flex size-5 items-center justify-center rounded-md bg-rose-500/15 text-rose-500 border border-rose-500/25">
            <FileText className="size-3" strokeWidth={1.75} />
          </div>
        ) : isCode ? (
          <div className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
            <FileCode2 className="size-3" strokeWidth={1.75} />
          </div>
        ) : (
          <div className="flex size-5 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-500 border border-cyan-500/25">
            <File className="size-3" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="max-w-[130px] sm:max-w-[180px] truncate text-xs font-semibold text-foreground">
          {name}
        </span>
        <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">
          {isPdf ? "PDF" : isImage ? "Image" : isCode ? "Code" : "File"}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 size-4 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
        title={`Remove ${name}`}
        aria-label={`Remove ${name}`}
      >
        <X className="size-2.5" strokeWidth={2} />
      </button>
    </div>
  )
}

function PromptAttachmentsPreview() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1.5 border-b border-border/40 bg-muted/20">
      {attachments.files.map((file) => (
        <AttachmentChip
          key={file.id}
          name={file.filename || "file"}
          contentType={file.mediaType}
          url={file.url}
          onRemove={() => attachments.remove(file.id)}
        />
      ))}
    </div>
  )
}

function PromptAttachButton() {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputButton
      tooltip="Attach documents or images (PDF, TXT, DOCX, PNG, JPG)"
      onClick={attachments.openFileDialog}
      className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
      aria-label="Attach file"
    >
      <Paperclip className="size-4" strokeWidth={1.75} />
    </PromptInputButton>
  )
}

function ChatView({
  chatId,
  bot,
  chat,
  bots,
  isGroup,
  selectedBotId,
  onSelectBot,
  transport,
  initialMessages,
}: {
  chatId: string
  bot?: ChatProps["bot"]
  chat?: ChatProps["chat"]
  bots: Array<any>
  isGroup: boolean
  selectedBotId: string
  onSelectBot: (botId: string) => void
  transport: DefaultChatTransport<UIMessage>
  initialMessages: UIMessage[]
}) {
  const { messages, sendMessage, status, stop, error, regenerate, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    throttle: 40,
  })

  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? bot
  const botName = selectedBot?.name || bot?.name || "AI Teammate"
  const botAvatar = selectedBot?.avatar || selectedBot?.name || bot?.avatar || bot?.name || chatId
  const isGenerating = status === "submitted" || status === "streaming"

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [promptText, setPromptText] = React.useState("")
  const [localAttachments, setLocalAttachments] = React.useState<
    Array<{ name: string; contentType: string; url: string; id: string }>
  >([])

  const handleVoiceTranscript = React.useCallback((transcript: string) => {
    setPromptText((prev) => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed} ${transcript}` : transcript
    })
  }, [])

  const inferContentType = (fileName: string, rawType?: string): string => {
    if (rawType && rawType !== "application/octet-stream" && rawType.trim()) return rawType
    const ext = fileName.toLowerCase().split(".").pop() || ""
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      txt: "text/plain",
      md: "text/markdown",
      markdown: "text/markdown",
      csv: "text/csv",
      json: "application/json",
      js: "text/javascript",
      ts: "text/typescript",
      jsx: "text/javascript",
      tsx: "text/typescript",
      py: "text/x-python",
      html: "text/html",
      css: "text/css",
      sh: "application/x-sh",
      bash: "application/x-sh",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    return mimeMap[ext] || rawType || "application/octet-stream"
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    const filePromises = Array.from(selectedFiles).map((file) => {
      return new Promise<{
        name: string
        contentType: string
        url: string
        id: string
      }>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            contentType: inferContentType(file.name, file.type),
            url: reader.result as string,
          })
        }
        reader.readAsDataURL(file)
      })
    })

    const newAttachments = await Promise.all(filePromises)
    setLocalAttachments((prev) => [...prev, ...newAttachments])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleRemoveAttachment = (id: string) => {
    setLocalAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // Deduplicate messages by ID to prevent any double-bubble ghost renders
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set<string>()
    return messages.filter((m) => {
      if (!m.id) return true
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
  }, [messages])

  // Automatically switch active bot in composer when a handoff finishes
  React.useEffect(() => {
    if (!uniqueMessages.length) return
    const lastMsg = uniqueMessages[uniqueMessages.length - 1]
    if (lastMsg.role === "assistant") {
      for (const part of lastMsg.parts) {
        if (
          isToolUIPart(part) &&
          getToolName(part) === "handoff" &&
          part.state === "output-available" &&
          (part.output as any)?.targetBot?.id
        ) {
          const targetId = (part.output as any).targetBot.id
          if (targetId && targetId !== selectedBotId) {
            onSelectBot(targetId)
          }
        }
      }
    }
  }, [uniqueMessages, selectedBotId, onSelectBot])

  return (
    <div className="relative flex flex-1 flex-col h-full min-h-0 overflow-hidden bg-background">
      <Conversation className="flex-1 min-h-0 overflow-y-auto">
        <ConversationContent className="mx-auto w-full max-w-4xl lg:max-w-5xl py-6 px-4 sm:px-6 space-y-6">
          {uniqueMessages.length === 0 ? (
            <ConversationEmptyState>
              <div className="flex flex-col items-center gap-4 max-w-md mx-auto py-8">
                {isGroup ? (
                  <GroupChatAvatar
                    bots={bots}
                    className="size-16 rounded-2xl mb-1 shadow-md"
                  />
                ) : (
                  <ChatAvatar
                    seed={botAvatar}
                    className="size-14 rounded-2xl mb-1 shadow-md"
                  />
                )}
                <div className="space-y-1.5 text-center">
                  <h3 className="font-semibold text-base sm:text-lg text-foreground">
                    {isGroup ? (chat?.name || "Group Chat") : `Talk with ${botName}`}
                  </h3>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
                    {isGroup
                      ? `Featuring ${bots.map((b) => b.name).join(", ")}. Pick a bot below or attach a document to start.`
                      : bot?.job
                      ? `${bot.job} — Ready to help you with your work.`
                      : "Send a message or attach a file to get started."}
                  </p>
                </div>

                {/* Quick starter action cards */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/80 hover:bg-secondary px-3.5 py-2 text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs hover:border-cyan-500/50 hover:text-cyan-400 group active:scale-95"
                  >
                    <FileUp className="size-4 text-cyan-400 group-hover:scale-110 transition-transform" strokeWidth={1.75} />
                    <span>Attach Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sendMessage({
                        parts: [
                          {
                            type: "text",
                            text: "Search for high-resolution images of modern AI computing clusters and summarize key specs.",
                          },
                        ],
                      })
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/80 hover:bg-secondary px-3.5 py-2 text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs hover:border-cyan-500/50 hover:text-cyan-400 group active:scale-95"
                  >
                    <Sparkles className="size-4 text-cyan-400 group-hover:scale-110 transition-transform" strokeWidth={1.75} />
                    <span>Search Web Images</span>
                  </button>
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            uniqueMessages.map((message, messageIndex) => {
              let msgBot: any = null
              let userTargetBot: any = null

              if (message.role === "assistant") {
                const directBotId = (message as any).metadata?.botId
                if (directBotId) {
                  msgBot = bots.find((b) => b.id === directBotId)
                }
                if (!msgBot && (message as any).metadata?.botName) {
                  msgBot = bots.find(
                    (b) => b.name === (message as any).metadata?.botName
                  )
                }
                if (!msgBot) {
                  for (let i = messageIndex - 1; i >= 0; i--) {
                    if (uniqueMessages[i].role === "user") {
                      const userTargetId = (uniqueMessages[i] as any).metadata?.botId
                      if (userTargetId) {
                        msgBot = bots.find((b) => b.id === userTargetId)
                      }
                      if (!msgBot && (uniqueMessages[i] as any).metadata?.botName) {
                        msgBot = bots.find(
                          (b) => b.name === (uniqueMessages[i] as any).metadata?.botName
                        )
                      }
                      break
                    }
                  }
                }
                if (!msgBot) {
                  msgBot = selectedBot || bots[0] || bot
                }
              } else if (message.role === "user" && isGroup) {
                const directBotId = (message as any).metadata?.botId
                if (directBotId) {
                  userTargetBot = bots.find((b) => b.id === directBotId)
                }
                if (!userTargetBot && (message as any).metadata?.botName) {
                  userTargetBot = bots.find(
                    (b) => b.name === (message as any).metadata?.botName
                  )
                }
                if (!userTargetBot) {
                  for (let i = messageIndex + 1; i < uniqueMessages.length; i++) {
                    if (uniqueMessages[i].role === "assistant") {
                      const nextBotId = (uniqueMessages[i] as any).metadata?.botId
                      if (nextBotId) {
                        userTargetBot = bots.find((b) => b.id === nextBotId)
                      }
                      if (!userTargetBot && (uniqueMessages[i] as any).metadata?.botName) {
                        userTargetBot = bots.find(
                          (b) => b.name === (uniqueMessages[i] as any).metadata?.botName
                        )
                      }
                      break
                    }
                  }
                }
                if (!userTargetBot) {
                  userTargetBot = selectedBot || bots[0] || bot
                }
              }

              const msgBotAvatar = msgBot?.avatar || msgBot?.name || botAvatar
              const msgBotName = msgBot?.name || botName

              // Skip empty assistant messages (e.g. from prior network aborts)
              if (
                message.role === "assistant" &&
                (!message.parts ||
                  message.parts.length === 0 ||
                  message.parts.every(
                    (p) => p.type === "text" && !p.text?.trim()
                  ))
              ) {
                return null
              }

              const isConsecutiveUser =
                message.role === "user" &&
                messageIndex > 0 &&
                uniqueMessages[messageIndex - 1]?.role === "user"

              if (message.role === "user") {
                const expAttachments = ((message as any).experimental_attachments || []) as Array<{
                  name: string
                  contentType?: string
                  url?: string
                }>
                const partUrls = new Set(
                  (message.parts || [])
                    .filter((p) => p.type === "file")
                    .map((p: any) => (p as any).url)
                    .filter(Boolean)
                )

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full justify-end",
                      isConsecutiveUser && "-mt-4"
                    )}
                  >
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-secondary text-secondary-foreground border border-border px-4 py-2.5 shadow-xs text-sm leading-relaxed space-y-2">
                      {/* Compact file badges from experimental_attachments */}
                      {expAttachments.map((att, attIdx) => {
                        if (att.url && partUrls.has(att.url)) return null
                        const isPdf =
                          att.contentType === "application/pdf" ||
                          att.name?.toLowerCase().endsWith(".pdf")
                        const isImage = att.contentType?.startsWith("image/")
                        const isCode = /\.(ts|js|py|json|csv|md|txt)$/i.test(att.name)

                        if (isImage && att.url) {
                          return (
                            <div
                              key={`exp-att-${attIdx}`}
                              className="rounded-xl overflow-hidden border border-border/60 bg-black/40 max-w-sm mt-1"
                            >
                              <img
                                src={att.url}
                                alt={att.name || "Uploaded image"}
                                className="max-h-60 w-auto object-contain rounded-lg"
                              />
                              {att.name && (
                                <div className="px-2.5 py-1 text-[11px] font-mono text-muted-foreground truncate border-t border-border/40">
                                  {att.name}
                                </div>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div
                            key={`exp-att-${attIdx}`}
                            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 p-2.5 max-w-sm shadow-xs mt-1"
                          >
                            <div
                              className={cn(
                                "flex size-9 items-center justify-center rounded-lg shrink-0",
                                isPdf
                                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                  : isCode
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20"
                              )}
                            >
                              {isPdf ? (
                                <FileText className="size-4.5" strokeWidth={1.75} />
                              ) : isCode ? (
                                <FileCode2 className="size-4.5" strokeWidth={1.75} />
                              ) : (
                                <File className="size-4.5" strokeWidth={1.75} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">
                                {att.name || "Attachment"}
                              </span>
                              <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                                {isPdf ? "PDF Document" : isCode ? "Code / Data" : att.contentType || "File"}
                              </span>
                            </div>
                            {att.url && (
                              <a
                                href={att.url}
                                download={att.name || "document"}
                                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                                title="Download attachment"
                              >
                                <Download className="size-3.5" strokeWidth={1.75} />
                              </a>
                            )}
                          </div>
                        )
                      })}

                      {message.parts.map((part, index) => {
                        if (part.type === "file") {
                          const isPdf =
                            part.mediaType === "application/pdf" ||
                            (part as any).filename?.toLowerCase().endsWith(".pdf")
                          const isImage = part.mediaType?.startsWith("image/")

                          if (isImage && (part as any).url) {
                            return (
                              <div
                                key={index}
                                className="rounded-xl overflow-hidden border border-border/60 bg-black/40 max-w-sm mt-1"
                              >
                                <img
                                  src={(part as any).url}
                                  alt={(part as any).filename || "Uploaded image"}
                                  className="max-h-60 w-auto object-contain rounded-lg"
                                />
                                {(part as any).filename && (
                                  <div className="px-2.5 py-1 text-[11px] font-mono text-muted-foreground truncate border-t border-border/40">
                                    {(part as any).filename}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 p-2.5 max-w-sm shadow-xs mt-1"
                            >
                              <div
                                className={cn(
                                  "flex size-9 items-center justify-center rounded-lg shrink-0",
                                  isPdf
                                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                    : "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20"
                                )}
                              >
                                {isPdf ? (
                                  <FileText className="size-4.5" strokeWidth={1.75} />
                                ) : (
                                  <File className="size-4.5" strokeWidth={1.75} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-xs font-semibold text-foreground">
                                  {(part as any).filename || "Document"}
                                </span>
                                <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                                  {isPdf ? "PDF Document" : part.mediaType || "Document"}
                                </span>
                              </div>
                              {(part as any).url && (
                                <a
                                  href={(part as any).url}
                                  download={(part as any).filename || "document"}
                                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                                  title="Download attachment"
                                >
                                  <Download className="size-3.5" strokeWidth={1.75} />
                                </a>
                              )}
                            </div>
                          )
                        }

                        if (part.type === "text") {
                          if (!part.text?.trim()) return null
                          return (
                            <div
                              key={index}
                              className="whitespace-pre-wrap break-words"
                            >
                              {isGroup && userTargetBot && index === 0 && (
                                <Badge
                                  variant="secondary"
                                  className="inline-flex items-center gap-1 h-5 pl-1 pr-1.5 mr-1.5 align-middle text-[11px] font-medium bg-background/80 border border-border/60 text-foreground shrink-0 max-w-[140px] select-none"
                                >
                                  <ChatAvatar
                                    seed={
                                      userTargetBot.avatar ||
                                      userTargetBot.name
                                    }
                                    className="size-3.5 rounded-full shrink-0"
                                  />
                                  <span className="truncate max-w-[90px]">
                                    @{userTargetBot.name}
                                  </span>
                                </Badge>
                              )}
                              <span>{part.text}</span>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                )
              }

              return (
                <div key={message.id} className="flex w-full justify-start gap-3">
                  <ChatAvatar
                    seed={msgBotAvatar}
                    alt={msgBotName}
                    className="size-8 rounded-xl shrink-0 mt-0.5 shadow-xs border border-border/50"
                  />
                  <div className="flex-1 min-w-0 w-full flex flex-col">
                    {isGroup && (
                      <span className="text-[11px] font-medium text-muted-foreground mb-1 pl-1 select-none">
                        {msgBotName}
                      </span>
                    )}
                    <div className="w-full text-foreground text-sm leading-relaxed space-y-3">
                      {(() => {
                        const groupedParts = groupMessageParts(message.parts || [])
                        let lastTextIdx = -1
                        for (let k = groupedParts.length - 1; k >= 0; k--) {
                          if (groupedParts[k].type === "text") {
                            lastTextIdx = k
                            break
                          }
                        }

                        return groupedParts.map((item, itemIdx) => {
                          if (item.type === "text") {
                            if (!item.text?.trim()) return null
                            const isLastMessage =
                              messageIndex === uniqueMessages.length - 1
                            const isLastPart = itemIdx === lastTextIdx
                            const isStreamingThis = isLastMessage && isGenerating

                            return (
                              <div key={item.key} className="relative inline-block w-full">
                                <MessageResponse
                                  mode={isStreamingThis ? "streaming" : "static"}
                                  isAnimating={isStreamingThis}
                                  animated={
                                    isStreamingThis
                                      ? { animation: "fadeIn", stagger: 20 }
                                      : false
                                  }
                                  caret={isStreamingThis ? "block" : undefined}
                                >
                                  {item.text}
                                </MessageResponse>
                                {isStreamingThis && isLastPart && (
                                  <span className="animate-typing-cursor" />
                                )}
                              </div>
                            )
                          }

                          if (item.type === "reasoning") {
                            return (
                              <Reasoning
                                key={item.key}
                                isStreaming={item.part.state === "streaming"}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{item.part.text}</ReasoningContent>
                              </Reasoning>
                            )
                          }

                          if (item.type === "showScreen" || item.type === "handoff") {
                            return (
                              <ToolPartView
                                key={item.key}
                                part={item.part}
                                sourceBot={msgBot}
                                onSelectBot={onSelectBot}
                              />
                            )
                          }

                          if (item.type === "toolGroup") {
                            return (
                              <ToolGroupView
                                key={item.key}
                                parts={item.parts}
                                sourceBot={msgBot}
                                onSelectBot={onSelectBot}
                              />
                            )
                          }

                          return null
                        })
                      })()}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {status === "submitted" && (
            <div className="flex w-full items-center gap-3 text-sm pl-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="relative shrink-0">
                <ChatAvatar
                  seed={selectedBot?.avatar || selectedBot?.name || botAvatar}
                  alt={selectedBot?.name || botName}
                  className="size-8 rounded-xl shadow-xs ring-2 ring-cyan-500/30 ring-offset-2 ring-offset-background animate-pulse"
                />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-cyan-500 ring-2 ring-background animate-ping" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-cyan-500 ring-2 ring-background" />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-2.5 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s] shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  <span className="size-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s] shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  <span className="size-2 rounded-full bg-cyan-300 animate-bounce shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground tracking-wide">
                    {isGroup && selectedBot?.name
                      ? `${selectedBot.name} is thinking...`
                      : `${botName} is thinking...`}
                  </span>
                  <span className="inline-block size-1.5 rounded-full bg-cyan-500 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" strokeWidth={1.75} />
                <span className="leading-snug">
                  {error.message?.includes("Tool result is missing") ||
                  error.message?.includes("MissingToolResultsError")
                    ? "The previous action completed. Please click Retry to continue."
                    : error.message?.includes("Minified React error") ||
                      error.message?.includes("Server Components render") ||
                      error.message?.includes("digest")
                    ? "Could not establish a connection to the chat service. Please check your network and try again."
                    : error.message ||
                      "An error occurred while generating the response. Please try again."}
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {typeof regenerate === "function" && (
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="size-3" strokeWidth={1.75} />
                    Retry
                  </button>
                )}
                {typeof clearError === "function" && (
                  <button
                    type="button"
                    onClick={() => clearError()}
                    className="p-1 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
                    title="Dismiss"
                    aria-label="Dismiss error"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="bg-gradient-to-t from-background via-background/95 to-transparent px-3 pb-3.5 pt-2 sm:px-6 sm:pb-5 shrink-0">
        <div className="mx-auto w-full max-w-3xl lg:max-w-4xl">
          <PromptInput
            className="rounded-[24px] border border-border/80 dark:border-white/[0.1] bg-card dark:bg-[#171a20] shadow-[0_6px_28px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.65)] focus-within:border-foreground/25 dark:focus-within:border-white/[0.22] focus-within:shadow-[0_8px_34px_-8px_rgba(0,0,0,0.16)] dark:focus-within:shadow-[0_14px_40px_-10px_rgba(0,0,0,0.75)] transition-all duration-200 overflow-hidden"
            accept=".pdf,.doc,.docx,.txt,.csv,.json,.md,.png,.jpg,.jpeg,.webp"
            multiple
            globalDrop
            onSubmit={({ text, files }) => {
              const trimmed = (promptText || text || "").trim()
              const allFiles = [
                ...localAttachments.map((a) => ({
                  filename: a.name,
                  mediaType: a.contentType,
                  url: a.url,
                })),
                ...(files || []).map((f) => ({
                  filename: f.filename,
                  mediaType: f.mediaType || "application/octet-stream",
                  url: f.url,
                })),
              ]

              if (!trimmed && allFiles.length === 0) return
              if (isGenerating) return

              const parts: Array<any> = []
              for (const f of allFiles) {
                parts.push({
                  type: "file",
                  mediaType: f.mediaType,
                  url: f.url,
                  filename: f.filename,
                })
              }
              if (trimmed) {
                parts.push({ type: "text", text: trimmed })
              } else if (allFiles.length > 0) {
                parts.push({
                  type: "text",
                  text: `Please analyze and summarize the attached ${
                    allFiles.length === 1 ? allFiles[0].filename : `${allFiles.length} files`
                  }.`,
                })
              }

              sendMessage(
                {
                  parts,
                  experimental_attachments: allFiles.map((f) => ({
                    name: f.filename,
                    contentType: f.mediaType,
                    url: f.url,
                  })),
                } as any,
                {
                  metadata: {
                    chatId,
                    botId: selectedBot?.id,
                    botName: selectedBot?.name,
                    botJob: selectedBot?.job,
                    botInstructions: selectedBot?.instructions ?? "",
                    sandboxId: selectedBot?.sandboxId ?? "",
                    isGroup,
                    chatName:
                      chat?.name ?? (isGroup ? "Group Chat" : undefined),
                    groupMembers: bots.map((b) => ({
                      id: b.id,
                      name: b.name,
                      job: b.job,
                      instructions: b.instructions ?? undefined,
                    })),
                  },
                }
              )
              setPromptText("")
              setLocalAttachments([])
            }}
          >
            {/* Display local uploaded attachments chips with remove button */}
            {localAttachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5 pb-2 border-b border-border/40 bg-muted/20 max-h-32 overflow-y-auto scrollbar-thin">
                {localAttachments.map((att) => (
                  <AttachmentChip
                    key={att.id}
                    id={att.id}
                    name={att.name}
                    contentType={att.contentType}
                    url={att.url}
                    onRemove={() => handleRemoveAttachment(att.id)}
                  />
                ))}
              </div>
            )}
            <PromptAttachmentsPreview />
            <PromptInputBody>
              <PromptInputTextarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder={
                  isGroup
                    ? `Message ${selectedBot?.name ?? "group"}...`
                    : `Message ${botName}...`
                }
                className="min-h-[44px] max-h-44 resize-none font-sans text-[15px] leading-6 px-4 pt-3.5 pb-1 placeholder:text-muted-foreground/55 text-foreground border-0 bg-transparent focus:outline-none focus:ring-0"
              />
            </PromptInputBody>
            <PromptInputFooter className="items-center px-3 pb-2.5 pt-1 justify-between">
              <PromptInputTools className="flex items-center gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.md,.csv,.json,.ts,.js,.py,.doc,.docx,.png,.jpg,.jpeg,.webp,.sh"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files (PDF, images, documents, code)"
                  className="relative inline-flex items-center justify-center size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 dark:hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
                  aria-label="Attach files"
                >
                  <PaperclipIcon className="size-4" strokeWidth={1.85} />
                  {localAttachments.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background ring-2 ring-card">
                      {localAttachments.length}
                    </span>
                  )}
                </button>
                <VoiceDictation
                  onTranscript={handleVoiceTranscript}
                  disabled={isGenerating}
                  className="h-8 px-2.5 rounded-full text-xs"
                />
                {isGroup && bots.length > 1 && (
                  <PromptInputSelect
                    value={selectedBotId}
                    onValueChange={(val: any) => {
                      if (typeof val === "string") {
                        onSelectBot(val)
                      }
                    }}
                  >
                    <PromptInputSelectTrigger className="h-8 min-w-[130px] max-w-[180px] gap-2 px-2.5 text-xs font-medium border border-border/70 dark:border-white/[0.08] bg-muted/50 dark:bg-white/[0.04] hover:bg-muted dark:hover:bg-white/[0.08] text-foreground transition-colors rounded-full cursor-pointer ml-1">
                      <ChatAvatar
                        seed={selectedBot?.avatar || selectedBot?.name || ""}
                        className="size-4 rounded-full shrink-0"
                      />
                      <span className="truncate flex-1 text-left">{selectedBot?.name ?? "Pick bot"}</span>
                      <span className="size-1.5 rounded-full bg-cyan-500 shrink-0" />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent className="w-64 border-border bg-popover text-popover-foreground p-1.5 shadow-xl">
                      {bots.map((b) => (
                        <PromptInputSelectItem key={b.id} value={b.id} className="cursor-pointer rounded-md py-2 px-2 hover:bg-accent/60">
                          <div className="flex items-center gap-2.5 w-full">
                            <ChatAvatar
                              seed={b.avatar || b.name}
                              className="size-5 rounded-full shrink-0"
                            />
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-xs text-foreground truncate">
                                  {b.name}
                                </span>
                                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-500/10 px-1 rounded border border-cyan-500/20">
                                  Ready
                                </span>
                              </div>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {b.job}
                              </span>
                            </div>
                          </div>
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                )}
              </PromptInputTools>

              {/* Clean monochrome circular submit/stop button */}
              <button
                type="submit"
                disabled={!isGenerating && !promptText.trim() && localAttachments.length === 0}
                onClick={(e) => {
                  if (isGenerating) {
                    e.preventDefault()
                    stop()
                  }
                }}
                aria-label={isGenerating ? "Stop generating" : "Send message"}
                title={isGenerating ? "Stop generating" : "Send message"}
                className={cn(
                  "inline-flex items-center justify-center size-8 rounded-full transition-all duration-150 select-none shrink-0",
                  isGenerating
                    ? "bg-foreground text-background hover:opacity-85 shadow-sm cursor-pointer active:scale-95"
                    : (promptText.trim() || localAttachments.length > 0)
                    ? "bg-foreground text-background hover:opacity-90 shadow-sm cursor-pointer active:scale-95"
                    : "bg-muted/70 dark:bg-white/[0.08] text-muted-foreground/45 cursor-not-allowed"
                )}
              >
                {isGenerating ? (
                  <Square className="size-3 fill-current rounded-[2px]" />
                ) : (
                  <ArrowUp className="size-4 stroke-[2.25]" />
                )}
              </button>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

export function getToolName(part: any): string {
  if (part.type === "dynamic-tool") return part.toolName
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.slice(5)
  }
  return part.type || "tool"
}

export function getToolDisplayInfo(toolName: string, input: any) {
  switch (toolName) {
    case "bash":
      return {
        title: input?.command ? `$ ${input.command}` : "Run bash command",
        icon: TerminalIcon,
      }
    case "webSearch":
      return {
        title: input?.query ? `Search web: "${input.query}"` : "Search web",
        icon: Search,
      }
    case "searchImages":
      return {
        title: input?.query ? `Search images: "${input.query}"` : "Search images",
        icon: Sparkles,
      }
    case "fetchUrl":
      return {
        title: input?.url
          ? `Fetch web: ${input.url.length > 40 ? input.url.slice(0, 40) + "..." : input.url}`
          : "Fetch web page",
        icon: Globe,
      }
    case "readFile":
      return {
        title: `Read ${input?.path || "file"}`,
        icon: FileText,
      }
    case "writeFile":
      return {
        title: `Write ${input?.path || "file"}`,
        icon: FileCode2,
      }
    case "listFiles":
      return {
        title: `List files: ${input?.path || "."}`,
        icon: FolderCode,
      }
    case "mouseClick":
      return {
        title: `Mouse click (${input?.x ?? 0}, ${input?.y ?? 0})${input?.button ? ` [${input.button}]` : ""}${input?.double ? " (double)" : ""}`,
        icon: MousePointerClick,
      }
    case "mouseMove":
      return {
        title: `Mouse move to (${input?.x ?? 0}, ${input?.y ?? 0})`,
        icon: MousePointer,
      }
    case "mouseScroll":
      return {
        title: `Mouse scroll ${input?.direction || "down"} (${input?.amount || 1})`,
        icon: ArrowUpDown,
      }
    case "keyboardType":
      return {
        title: `Type "${input?.text && input.text.length > 25 ? input.text.slice(0, 25) + "..." : input?.text || ""}"`,
        icon: Keyboard,
      }
    case "keyboardPress":
      return {
        title: `Press key ${input?.modifiers?.length ? input.modifiers.join("+") + "+" : ""}${input?.key || ""}`,
        icon: Command,
      }
    case "showScreen":
      return {
        title: "Desktop Screen",
        icon: MonitorDot,
      }
    case "handoff":
      return {
        title: `Hand off to ${input?.targetBotName || "teammate"}`,
        icon: ArrowRightLeft,
      }
    case "getMemory":
      return {
        title: "Recall memory (MEMORY.md)",
        icon: BrainCircuit,
      }
    case "setMemory":
      return {
        title:
          input?.mode === "replace"
            ? "Update memory (MEMORY.md)"
            : "Save to memory (MEMORY.md)",
        icon: Database,
      }
    default:
      return {
        title: toolName,
        icon: Cpu,
      }
  }
}

export type GroupedMessagePart =
  | { type: "text"; text: string; key: string }
  | { type: "reasoning"; part: any; key: string }
  | { type: "showScreen"; part: any; key: string }
  | { type: "handoff"; part: any; key: string }
  | { type: "toolGroup"; parts: any[]; key: string }

export function groupMessageParts(parts: any[]): GroupedMessagePart[] {
  const grouped: GroupedMessagePart[] = []
  let currentToolGroup: any[] = []

  const flushToolGroup = () => {
    if (currentToolGroup.length > 0) {
      grouped.push({
        type: "toolGroup",
        parts: [...currentToolGroup],
        key: `tool-group-${grouped.length}-${currentToolGroup[0]?.toolCallId || Math.random()}`,
      })
      currentToolGroup = []
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.type === "text") {
      flushToolGroup()
      if (part.text?.trim()) {
        grouped.push({ type: "text", text: part.text, key: `text-${i}` })
      }
    } else if (part.type === "reasoning") {
      flushToolGroup()
      grouped.push({ type: "reasoning", part, key: `reasoning-${i}` })
    } else if (isToolUIPart(part)) {
      const toolName = getToolName(part)
      if (toolName === "viewScreen") {
        // internal only, never rendered in chat
        continue
      }
      if (
        toolName === "showScreen" &&
        part.state === "output-available" &&
        (part.output as any)?.screenshot
      ) {
        flushToolGroup()
        grouped.push({ type: "showScreen", part, key: `screen-${i}` })
      } else if (toolName === "handoff") {
        flushToolGroup()
        grouped.push({ type: "handoff", part, key: `handoff-${i}` })
      } else {
        currentToolGroup.push(part)
      }
    }
  }

  flushToolGroup()
  return grouped
}

export function ToolGroupView({
  parts,
  sourceBot,
  onSelectBot,
}: {
  parts: any[]
  sourceBot?: any
  onSelectBot?: (botId: string) => void
}) {
  const isAnyRunning = parts.some(
    (p) =>
      p.state === "input-available" ||
      p.state === "input-streaming" ||
      p.state === "call"
  )

  const [isOpen, setIsOpen] = React.useState(isAnyRunning)

  React.useEffect(() => {
    if (isAnyRunning) {
      setIsOpen(true)
    }
  }, [isAnyRunning])

  if (parts.length === 0) return null

  // Single tool call: render standard compact ToolPartView directly
  if (parts.length === 1) {
    return (
      <ToolPartView
        part={parts[0]}
        sourceBot={sourceBot}
        onSelectBot={onSelectBot}
      />
    )
  }

  // Multiple tool calls: generate a concise Gemini / ChatGPT style activity bar
  const searches = parts.filter(
    (p) => getToolName(p) === "webSearch" || getToolName(p) === "searchImages"
  )
  const bashCommands = parts.filter((p) => getToolName(p) === "bash")
  const desktopActions = parts.filter((p) =>
    [
      "mouseClick",
      "mouseMove",
      "mouseScroll",
      "keyboardType",
      "keyboardPress",
    ].includes(getToolName(p))
  )

  let summaryTitle = `${parts.length} actions completed`
  let IconComponent = Sparkles

  if (searches.length === parts.length) {
    const webCount = parts.filter((p) => getToolName(p) === "webSearch").length
    const imgCount = parts.filter((p) => getToolName(p) === "searchImages").length
    if (imgCount > 0 && webCount > 0) {
      summaryTitle = `Researched web & ${imgCount} image ${imgCount === 1 ? "query" : "queries"}`
    } else if (imgCount > 0) {
      summaryTitle = `Searched ${imgCount} image ${imgCount === 1 ? "source" : "sources"}`
    } else {
      summaryTitle = `Searched web (${webCount} ${webCount === 1 ? "query" : "queries"})`
    }
    IconComponent = Search
  } else if (bashCommands.length === parts.length) {
    summaryTitle = `Executed ${bashCommands.length} terminal ${bashCommands.length === 1 ? "command" : "commands"}`
    IconComponent = TerminalIcon
  } else if (desktopActions.length > 0) {
    summaryTitle = `Performed ${parts.length} desktop & terminal actions`
    IconComponent = MonitorDot
  }

  const activeRunningTool = parts.find(
    (p) =>
      p.state === "input-available" ||
      p.state === "input-streaming" ||
      p.state === "call"
  )
  const activeRunningInfo = activeRunningTool
    ? getToolDisplayInfo(getToolName(activeRunningTool), activeRunningTool.input)
    : null

  return (
    <div className="w-full max-w-2xl my-1.5 not-prose">
      {/* Sleek Gemini / ChatGPT style activity toggle bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={cn(
          "flex items-center justify-between w-full px-3 py-1.5 rounded-xl border text-xs transition-all duration-150 cursor-pointer select-none shadow-2xs group",
          isAnyRunning
            ? "border-cyan-500/40 bg-cyan-500/5 ring-1 ring-cyan-500/20 text-cyan-400"
            : "border-border/60 bg-card/60 hover:bg-card/90 text-foreground"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border shadow-2xs",
              isAnyRunning
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                : "bg-secondary text-cyan-500 border-border/70"
            )}
          >
            {isAnyRunning ? (
              <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
            ) : (
              <IconComponent className="size-3 text-cyan-500" strokeWidth={1.75} />
            )}
          </div>
          <span className="font-medium text-xs truncate">
            {isAnyRunning && activeRunningInfo?.title
              ? `Running: ${activeRunningInfo.title}`
              : summaryTitle}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 shrink-0">
            {isAnyRunning ? "In progress" : `${parts.length} steps`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground group-hover:text-foreground">
          <span className="text-[10px] hidden sm:inline text-muted-foreground/70 font-mono">
            {isOpen ? "Hide activity" : "View activity"}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            strokeWidth={1.75}
          />
        </div>
      </button>

      {/* Expanded timeline view */}
      {isOpen && (
        <div className="mt-1.5 ml-2.5 pl-3 border-l-2 border-border/60 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {parts.map((p, idx) => (
            <ToolPartView
              key={p.toolCallId || `part-${idx}`}
              part={p}
              sourceBot={sourceBot}
              onSelectBot={onSelectBot}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ToolPartView({
  part,
  sourceBot,
  onSelectBot,
}: {
  part: any
  sourceBot?: any
  onSelectBot?: (botId: string) => void
}) {
  const toolName = getToolName(part)
  const [isOpen, setIsOpen] = React.useState(part.state !== "output-available")

  React.useEffect(() => {
    if (part.state === "output-available") {
      setIsOpen(false)
    }
  }, [part.state])

  // 1. viewScreen: "never rendered in chat"
  if (toolName === "viewScreen") {
    return null
  }

  // 2. handoff: specialized collaborative UI
  if (toolName === "handoff") {
    const targetName =
      part.output?.targetBot?.name || part.input?.targetBotName || "Teammate"
    const targetJob = part.output?.targetBot?.job || "AI Teammate"
    const targetId = part.output?.targetBot?.id || part.input?.targetBotId
    const reason = part.output?.reason || part.input?.reason
    const isError =
      part.state === "output-error" ||
      (part.state === "output-available" && !part.output?.success)

    if (isError) {
      return (
        <div className="my-2.5 flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <ArrowRightLeft className="size-4 shrink-0" strokeWidth={1.75} />
          <span>
            Handoff error:{" "}
            {part.errorText || part.output?.error || "Failed to hand off"}
          </span>
        </div>
      )
    }

    return (
      <div className="my-3 overflow-hidden rounded-xl border border-cyan-500/25 bg-cyan-500/5 dark:bg-cyan-950/20 p-3.5 shadow-xs transition-all duration-200 hover:border-cyan-500/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-1.5 shrink-0">
              <ChatAvatar
                seed={sourceBot?.avatar || sourceBot?.name || "agent"}
                className="size-7 rounded-lg border border-background shadow-xs z-10"
              />
              <div className="flex size-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-500 border border-cyan-500/30 z-20 shadow-xs">
                <ArrowRightLeft className="size-3 animate-pulse" strokeWidth={1.75} />
              </div>
              <ChatAvatar
                seed={targetName}
                className="size-7 rounded-lg border border-background shadow-xs z-30"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  {sourceBot?.name || "Agent"}
                </span>
                <span className="text-[10px] text-muted-foreground">handed off to</span>
                <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                  {targetName}
                </span>
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Role: <span className="text-foreground/90 font-medium">{targetJob}</span>
              </p>
            </div>
          </div>
          {onSelectBot && targetId && (
            <button
              type="button"
              onClick={() => onSelectBot(targetId)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-500/60 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <ChatAvatar seed={targetName} className="size-3.5 rounded-xs" />
              <span>Switch to {targetName}</span>
            </button>
          )}
        </div>
        {reason && (
          <div className="mt-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground border border-border font-mono">
            <span className="text-foreground font-sans font-medium">Handoff reason: </span>
            {reason}
          </div>
        )}
      </div>
    )
  }

  // 3. showScreen: "rendered in chat"
  if (toolName === "showScreen") {
    if (part.state === "output-available" && part.output?.screenshot) {
      const screenshotData = `data:image/png;base64,${part.output.screenshot}`
      return (
        <div className="my-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2 text-xs font-medium text-muted-foreground select-none">
            <span className="flex items-center gap-2 text-foreground font-semibold">
              <MonitorDot className="size-4 text-cyan-400" strokeWidth={1.75} />
              Desktop Screen
            </span>
            <div className="flex items-center gap-2">
              {part.output?.sizeBytes && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {(part.output.sizeBytes / 1024).toFixed(1)} KB
                </span>
              )}
              <a
                href={screenshotData}
                download="desktop-screenshot.png"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Download className="size-3.5" strokeWidth={1.75} />
                <span>Save</span>
              </a>
            </div>
          </div>
          <div className="relative aspect-video max-h-[500px] w-full overflow-hidden bg-muted/20 flex items-center justify-center p-1.5">
            <img
              src={screenshotData}
              alt="Sandbox desktop screenshot"
              className="h-full w-full object-contain rounded-lg border border-border/50"
            />
          </div>
        </div>
      )
    }

    if (
      part.state === "output-error" ||
      (part.state === "output-available" && !part.output?.success)
    ) {
      return (
        <div className="my-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <MonitorDot className="size-4 shrink-0" strokeWidth={1.75} />
          <span>
            Failed to capture screen:{" "}
            {part.errorText || part.output?.error || "Unknown error"}
          </span>
        </div>
      )
    }

    return (
      <div className="my-2.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground animate-pulse">
        <MonitorDot className="size-4 text-cyan-400" strokeWidth={1.75} />
        <span>Capturing desktop screen...</span>
      </div>
    )
  }

  // 4. bash: specialized terminal output
  if (toolName === "bash") {
    const { title, icon } = getToolDisplayInfo(toolName, part.input)
    return (
      <Tool open={isOpen} onOpenChange={setIsOpen} state={part.state} className="my-1 max-w-2xl">
        <ToolHeader
          title={title}
          type={part.type as any}
          state={part.state}
          toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
          icon={icon}
        />
        <ToolContent>
          {part.input?.command && (
            <div className="space-y-1">
              <h4 className="font-medium text-muted-foreground text-[10px] uppercase tracking-wider font-mono">
                Command
              </h4>
              <div className="rounded bg-muted/40 border border-border/60 px-2.5 py-1.5 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 break-all">
                $ {part.input.command}
              </div>
            </div>
          )}
          {part.output?.stdout ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-muted-foreground text-[10px] uppercase tracking-wider font-mono">
                  Output
                </h4>
                {typeof part.output.exitCode === "number" && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    exit code: {part.output.exitCode}
                  </span>
                )}
              </div>
              <Terminal output={part.output.stdout}>
                <TerminalHeader>
                  <TerminalTitle>Terminal</TerminalTitle>
                  <TerminalActions>
                    <TerminalCopyButton />
                  </TerminalActions>
                </TerminalHeader>
                <TerminalContent />
              </Terminal>
            </div>
          ) : (
            <ToolOutput output={part.output} errorText={part.errorText} />
          )}
        </ToolContent>
      </Tool>
    )
  }

  // 5. searchImages: specialized visual thumbnail gallery
  if (toolName === "searchImages") {
    const { title, icon } = getToolDisplayInfo(toolName, part.input)
    const images = (part.output as any)?.images || []
    return (
      <Tool open={isOpen} onOpenChange={setIsOpen} state={part.state} className="my-1 max-w-2xl">
        <ToolHeader
          title={title}
          type={part.type as any}
          state={part.state}
          toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
          icon={icon}
        />
        <ToolContent>
          {images.length > 0 ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                {images.map((img: any, idx: number) => (
                  <a
                    key={idx}
                    href={img.sourceUrl || img.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-video overflow-hidden rounded-md border border-border/80 bg-muted/40 hover:border-cyan-500/50 transition-all shadow-2xs"
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.title || "Image"}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1">
                      <span className="block truncate text-[9px] font-medium text-white/90">
                        {img.title}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <ToolOutput output={part.output} errorText={part.errorText} />
          )}
        </ToolContent>
      </Tool>
    )
  }

  // 6. All other tools (readFile, writeFile, listFiles, mouse, keyboard)
  const { title, icon } = getToolDisplayInfo(toolName, part.input)
  return (
    <Tool open={isOpen} onOpenChange={setIsOpen} state={part.state} className="my-1 max-w-2xl">
      <ToolHeader
        title={title}
        type={part.type as any}
        state={part.state}
        toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
        icon={icon}
      />
      <ToolContent>
        {part.input && <ToolInput input={part.input} />}
        <ToolOutput output={part.output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  )
}

