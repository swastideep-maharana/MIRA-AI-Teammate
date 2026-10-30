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
import {
  TerminalIcon,
  FileTextIcon,
  FileCodeIcon,
  FolderIcon,
  MousePointerClickIcon,
  MousePointerIcon,
  ArrowUpDownIcon,
  ArrowRightLeftIcon,
  KeyboardIcon,
  MonitorIcon,
  DownloadIcon,
  WrenchIcon,
  BrainIcon,
  PaperclipIcon,
  FileIcon,
  XIcon,
  GlobeIcon,
  SearchIcon,
  PlusIcon,
  ImageIcon,
  ExternalLinkIcon,
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

function PromptAttachmentsPreview() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-1 border-b border-border/40 bg-muted/20">
      {attachments.files.map((file) => {
        const isPdf =
          file.mediaType === "application/pdf" ||
          file.filename?.toLowerCase().endsWith(".pdf")
        const isImage = file.mediaType?.startsWith("image/")

        return (
          <div
            key={file.id}
            className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs text-foreground shadow-2xs group"
          >
            {isImage ? (
              <img
                src={file.url}
                alt={file.filename || "Attachment"}
                className="size-4 rounded object-cover"
              />
            ) : isPdf ? (
              <FileTextIcon className="size-3.5 text-rose-500 shrink-0" />
            ) : (
              <FileIcon className="size-3.5 text-cyan-500 shrink-0" />
            )}
            <span className="max-w-[150px] truncate text-xs font-medium">
              {file.filename || "file"}
            </span>
            <button
              type="button"
              onClick={() => attachments.remove(file.id)}
              className="ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded p-0.5 transition-colors cursor-pointer"
              title="Remove attachment"
              aria-label="Remove attachment"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )
      })}
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
      <PaperclipIcon className="size-4" />
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
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  })

  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? bot
  const botName = selectedBot?.name || bot?.name || "AI Teammate"
  const botAvatar = selectedBot?.avatar || selectedBot?.name || bot?.avatar || bot?.name || chatId
  const isGenerating = status === "submitted" || status === "streaming"

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [localAttachments, setLocalAttachments] = React.useState<
    Array<{ name: string; contentType: string; url: string; id: string }>
  >([])

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
                    <FileTextIcon className="size-4 text-cyan-500 group-hover:scale-110 transition-transform" />
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
                    <ImageIcon className="size-4 text-cyan-500 group-hover:scale-110 transition-transform" />
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
                                <FileTextIcon className="size-4.5" />
                              ) : isCode ? (
                                <FileCodeIcon className="size-4.5" />
                              ) : (
                                <FileIcon className="size-4.5" />
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
                                <DownloadIcon className="size-3.5" />
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
                                  <FileTextIcon className="size-4.5" />
                                ) : (
                                  <FileIcon className="size-4.5" />
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
                                  <DownloadIcon className="size-3.5" />
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
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          if (!part.text?.trim()) return null
                          const isLastMessage =
                            messageIndex === uniqueMessages.length - 1
                          const isLastPart = index === message.parts.length - 1
                          const isStreamingThis = isLastMessage && isGenerating

                          return (
                            <div key={index} className="relative inline-block w-full">
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
                                {part.text}
                              </MessageResponse>
                              {isStreamingThis && isLastPart && (
                                <span className="animate-typing-cursor" />
                              )}
                            </div>
                          )
                        }

                        if (part.type === "reasoning") {
                          return (
                            <Reasoning
                              key={index}
                              isStreaming={part.state === "streaming"}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          )
                        }

                        if (isToolUIPart(part)) {
                          return (
                            <ToolPartView
                              key={index}
                              part={part}
                              sourceBot={msgBot}
                              onSelectBot={onSelectBot}
                            />
                          )
                        }

                        return null
                      })}
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
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message?.includes("Minified React error") ||
              error.message?.includes("Server Components render") ||
              error.message?.includes("digest")
                ? "Could not establish a connection to the chat service. Please check your network and try again."
                : error.message ||
                  "An error occurred while generating the response. Please try again."}
            </div>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/95 backdrop-blur-md p-3 sm:p-4 shrink-0">
        <div className="mx-auto w-full max-w-4xl lg:max-w-5xl">
          <PromptInput
            className="rounded-xl border border-border bg-card shadow-md focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30 transition-all overflow-hidden"
            accept=".pdf,.doc,.docx,.txt,.csv,.json,.md,.png,.jpg,.jpeg,.webp"
            multiple
            globalDrop
            onSubmit={({ text, files }) => {
              const trimmed = text.trim()
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
              setLocalAttachments([])
            }}
          >
            {/* Display local uploaded attachments chips with remove button */}
            {localAttachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5 pb-2 border-b border-border/40 bg-muted/20 max-h-32 overflow-y-auto scrollbar-thin">
                {localAttachments.map((att) => {
                  const isPdf =
                    att.contentType === "application/pdf" ||
                    att.name.toLowerCase().endsWith(".pdf")
                  const isImage = att.contentType.startsWith("image/")
                  const isCode = /\.(ts|js|py|json|csv|md|txt)$/i.test(att.name)

                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs text-foreground shadow-2xs group shrink-0"
                    >
                      {isImage ? (
                        <img
                          src={att.url}
                          alt={att.name}
                          className="size-4 rounded object-cover"
                        />
                      ) : isPdf ? (
                        <FileTextIcon className="size-3.5 text-rose-500 shrink-0" />
                      ) : isCode ? (
                        <FileCodeIcon className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <FileIcon className="size-3.5 text-cyan-500 shrink-0" />
                      )}
                      <span className="max-w-[140px] sm:max-w-[180px] truncate text-xs font-medium">
                        {att.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded p-0.5 transition-colors cursor-pointer"
                        title={`Remove ${att.name}`}
                        aria-label={`Remove ${att.name}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <PromptAttachmentsPreview />
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={
                  isGroup
                    ? `Message ${selectedBot?.name ?? "group"}... (drop PDF or files)`
                    : `Message ${botName}... (drop PDF or files)`
                }
                className="min-h-12 max-h-48 resize-none font-sans text-sm placeholder:text-muted-foreground/70"
              />
            </PromptInputBody>
            <PromptInputFooter className="items-center">
              <PromptInputTools className="flex items-center gap-2">
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
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border/80 bg-secondary/80 hover:bg-secondary text-foreground hover:text-cyan-400 shadow-2xs transition-all cursor-pointer group active:scale-95"
                  aria-label="Attach files"
                >
                  <PaperclipIcon className="size-3.5 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                  <span className="text-xs font-medium">Attach</span>
                  {localAttachments.length > 0 && (
                    <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-black">
                      {localAttachments.length}
                    </span>
                  )}
                </button>
                {isGroup && bots.length > 1 && (
                  <PromptInputSelect
                    value={selectedBotId}
                    onValueChange={(val: any) => {
                      if (typeof val === "string") {
                        onSelectBot(val)
                      }
                    }}
                  >
                    <PromptInputSelectTrigger className="h-8 min-w-[150px] max-w-[200px] gap-2 px-2.5 text-xs font-medium border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors rounded-lg shadow-xs cursor-pointer">
                      <ChatAvatar
                        seed={selectedBot?.avatar || selectedBot?.name || ""}
                        className="size-4 rounded-xs shrink-0"
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
                              className="size-5 rounded-xs shrink-0"
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
              <PromptInputSubmit
                status={status}
                onStop={stop}
                className="min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 rounded-lg cursor-pointer"
              />
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
        icon: SearchIcon,
      }
    case "searchImages":
      return {
        title: input?.query ? `Search images: "${input.query}"` : "Search images",
        icon: ImageIcon,
      }
    case "fetchUrl":
      return {
        title: input?.url
          ? `Fetch web: ${input.url.length > 40 ? input.url.slice(0, 40) + "..." : input.url}`
          : "Fetch web page",
        icon: GlobeIcon,
      }
    case "readFile":
      return {
        title: `Read ${input?.path || "file"}`,
        icon: FileTextIcon,
      }
    case "writeFile":
      return {
        title: `Write ${input?.path || "file"}`,
        icon: FileCodeIcon,
      }
    case "listFiles":
      return {
        title: `List files: ${input?.path || "."}`,
        icon: FolderIcon,
      }
    case "mouseClick":
      return {
        title: `Mouse click (${input?.x ?? 0}, ${input?.y ?? 0})${input?.button ? ` [${input.button}]` : ""}${input?.double ? " (double)" : ""}`,
        icon: MousePointerClickIcon,
      }
    case "mouseMove":
      return {
        title: `Mouse move to (${input?.x ?? 0}, ${input?.y ?? 0})`,
        icon: MousePointerIcon,
      }
    case "mouseScroll":
      return {
        title: `Mouse scroll ${input?.direction || "down"} (${input?.amount || 1})`,
        icon: ArrowUpDownIcon,
      }
    case "keyboardType":
      return {
        title: `Type "${input?.text && input.text.length > 25 ? input.text.slice(0, 25) + "..." : input?.text || ""}"`,
        icon: KeyboardIcon,
      }
    case "keyboardPress":
      return {
        title: `Press key ${input?.modifiers?.length ? input.modifiers.join("+") + "+" : ""}${input?.key || ""}`,
        icon: KeyboardIcon,
      }
    case "showScreen":
      return {
        title: "Desktop Screen",
        icon: MonitorIcon,
      }
    case "handoff":
      return {
        title: `Hand off to ${input?.targetBotName || "teammate"}`,
        icon: ArrowRightLeftIcon,
      }
    case "getMemory":
      return {
        title: "Recall memory (MEMORY.md)",
        icon: BrainIcon,
      }
    case "setMemory":
      return {
        title:
          input?.mode === "replace"
            ? "Update memory (MEMORY.md)"
            : "Save to memory (MEMORY.md)",
        icon: BrainIcon,
      }
    default:
      return {
        title: toolName,
        icon: WrenchIcon,
      }
  }
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
          <ArrowRightLeftIcon className="size-4 shrink-0" />
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
                <ArrowRightLeftIcon className="size-3 animate-pulse" />
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
              <MonitorIcon className="size-4 text-cyan-500" />
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
                <DownloadIcon className="size-3.5" />
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
          <MonitorIcon className="size-4 shrink-0" />
          <span>
            Failed to capture screen:{" "}
            {part.errorText || part.output?.error || "Unknown error"}
          </span>
        </div>
      )
    }

    return (
      <div className="my-2.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground animate-pulse">
        <MonitorIcon className="size-4 text-cyan-500" />
        <span>Capturing desktop screen...</span>
      </div>
    )
  }

  // 4. bash: specialized terminal output
  if (toolName === "bash") {
    const { title } = getToolDisplayInfo(toolName, part.input)
    return (
      <Tool open={isOpen} onOpenChange={setIsOpen} state={part.state} className="my-2.5">
        <ToolHeader
          title={title}
          type={part.type as any}
          state={part.state}
          toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
        />
        <ToolContent>
          {part.input?.command && (
            <div className="space-y-1.5">
              <h4 className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider font-mono">
                Command
              </h4>
              <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 font-mono text-xs text-cyan-600 dark:text-cyan-400">
                $ {part.input.command}
              </div>
            </div>
          )}
          {part.output?.stdout ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider font-mono">
                  Output
                </h4>
                {typeof part.output.exitCode === "number" && (
                  <span className="text-[11px] text-muted-foreground font-mono">
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
    const { title } = getToolDisplayInfo(toolName, part.input)
    const images = (part.output as any)?.images || []
    return (
      <Tool open={isOpen} onOpenChange={setIsOpen} state={part.state} className="my-2.5">
        <ToolHeader
          title={title}
          type={part.type as any}
          state={part.state}
          toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
        />
        <ToolContent>
          {images.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {images.map((img: any, idx: number) => (
                  <a
                    key={idx}
                    href={img.sourceUrl || img.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-video overflow-hidden rounded-lg border border-border bg-muted/40 hover:border-cyan-500/50 transition-all shadow-2xs"
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.title || "Image"}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5">
                      <span className="block truncate text-[10px] font-medium text-white/90">
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
  const { title } = getToolDisplayInfo(toolName, part.input)
  return (
    <Tool open={isOpen} onOpenChange={setIsOpen} state={part.state} className="my-2.5">
      <ToolHeader
        title={title}
        type={part.type as any}
        state={part.state}
        toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
      />
      <ToolContent>
        {part.input && <ToolInput input={part.input} />}
        <ToolOutput output={part.output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  )
}

