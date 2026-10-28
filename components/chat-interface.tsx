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
} from "lucide-react"
import { ChatAvatar } from "@/components/chat-avatar"
import { Badge } from "@/components/ui/badge"

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

  // Automatically switch active bot in composer when a handoff finishes
  React.useEffect(() => {
    if (!messages.length) return
    const lastMsg = messages[messages.length - 1]
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
  }, [messages, selectedBotId, onSelectBot])

  return (
    <div className="relative flex flex-1 flex-col h-full min-h-0 overflow-hidden bg-background">
      <Conversation className="flex-1 min-h-0 overflow-y-auto">
        <ConversationContent className="mx-auto w-full max-w-3xl py-6 px-4 space-y-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                isGroup ? (
                  <GroupChatAvatar
                    bots={bots}
                    className="size-14 rounded-2xl mb-3 shadow-sm"
                  />
                ) : (
                  <ChatAvatar
                    seed={botAvatar}
                    className="size-12 rounded-xl mb-3 shadow-sm"
                  />
                )
              }
              title={isGroup ? (chat?.name || "Group Chat") : `Talk with ${botName}`}
              description={
                isGroup
                  ? `Featuring ${bots.map((b) => b.name).join(", ")}. Pick a bot below to chat!`
                  : bot?.job
                  ? `${bot.job} — Ready to help you with your work.`
                  : "Send a message to start chatting."
              }
            />
          ) : (
            messages.map((message, messageIndex) => {
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
                    if (messages[i].role === "user") {
                      const userTargetId = (messages[i] as any).metadata?.botId
                      if (userTargetId) {
                        msgBot = bots.find((b) => b.id === userTargetId)
                      }
                      if (!msgBot && (messages[i] as any).metadata?.botName) {
                        msgBot = bots.find(
                          (b) => b.name === (messages[i] as any).metadata?.botName
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
                  for (let i = messageIndex + 1; i < messages.length; i++) {
                    if (messages[i].role === "assistant") {
                      const nextBotId = (messages[i] as any).metadata?.botId
                      if (nextBotId) {
                        userTargetBot = bots.find((b) => b.id === nextBotId)
                      }
                      if (!userTargetBot && (messages[i] as any).metadata?.botName) {
                        userTargetBot = bots.find(
                          (b) => b.name === (messages[i] as any).metadata?.botName
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

              return (
                <div
                  key={message.id}
                  className={`flex w-full gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <ChatAvatar
                      seed={msgBotAvatar}
                      alt={msgBotName}
                      className="size-7 rounded-sm shrink-0 mt-1 shadow-xs"
                    />
                  )}
                  <div
                    className={`flex flex-col ${
                      message.role === "user"
                        ? "items-end max-w-[80%]"
                        : "items-start max-w-[90%]"
                    }`}
                  >
                    {isGroup && message.role === "assistant" && (
                      <span className="text-[11px] font-medium text-muted-foreground mb-1 pl-1 select-none">
                        {msgBotName}
                      </span>
                    )}
                    <Message
                      from={message.role}
                      className="w-full"
                    >
                      <MessageContent className="w-full">
                        {message.parts.map((part, index) => {
                          if (part.type === "text") {
                            if (!part.text?.trim()) return null
                            if (message.role === "user") {
                              return (
                                <div
                                  key={index}
                                  className="whitespace-pre-wrap break-words leading-relaxed"
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

                            return (
                              <MessageResponse key={index}>
                                {part.text}
                              </MessageResponse>
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
                                onSelectBot={onSelectBot}
                              />
                            )
                          }

                          return null
                        })}
                      </MessageContent>
                    </Message>
                  </div>
                </div>
              )
            })
          )}

          {status === "submitted" && (
            <div className="flex w-full items-center gap-3 text-muted-foreground text-sm pl-1">
              <ChatAvatar
                seed={selectedBot?.avatar || selectedBot?.name || botAvatar}
                alt={selectedBot?.name || botName}
                className="size-7 rounded-sm shrink-0 shadow-xs"
              />
              <span className="inline-flex items-center gap-1.5 animate-pulse font-medium">
                {isGroup && selectedBot?.name
                  ? `${selectedBot.name} is thinking...`
                  : "Thinking..."}
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message?.includes("Minified React error") ||
              error.message?.includes("Server Components render") ||
              error.message?.includes("digest")
                ? "The AI agent connection failed (HTTP 500). If running locally, ensure your Trigger.dev dev worker is running (`npx trigger.dev@latest dev`). In production, verify that your TRIGGER_SECRET_KEY is configured."
                : error.message ||
                  "An error occurred while generating the response. Please try again."}
            </div>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-background/95 backdrop-blur-sm p-4 shrink-0">
        <div className="mx-auto max-w-3xl">
          <PromptInput
            onSubmit={({ text }) => {
              const trimmed = text.trim()
              if (!trimmed || isGenerating) return
              sendMessage(
                { text: trimmed },
                {
                  metadata: {
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
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={
                  isGroup
                    ? `Message ${selectedBot?.name ?? "group"}...`
                    : `Message ${botName}...`
                }
                className="min-h-12 max-h-48 resize-none"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                {isGroup && bots.length > 1 && (
                  <PromptInputSelect
                    value={selectedBotId}
                    onValueChange={(val: any) => {
                      if (typeof val === "string") {
                        onSelectBot(val)
                      }
                    }}
                  >
                    <PromptInputSelectTrigger className="h-7 gap-1.5 px-2 text-xs font-medium max-w-[170px] border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors">
                      <ChatAvatar
                        seed={selectedBot?.avatar || selectedBot?.name || ""}
                        className="size-3.5 rounded-xs shrink-0"
                      />
                      <span className="truncate">{selectedBot?.name ?? "Pick bot"}</span>
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {bots.map((b) => (
                        <PromptInputSelectItem key={b.id} value={b.id}>
                          <div className="flex items-center gap-2">
                            <ChatAvatar
                              seed={b.avatar || b.name}
                              className="size-4 rounded-xs shrink-0"
                            />
                            <span className="font-medium text-xs text-foreground">
                              {b.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                              ({b.job})
                            </span>
                          </div>
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                )}
              </PromptInputTools>
              <PromptInputSubmit status={status} onStop={stop} />
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
  onSelectBot,
}: {
  part: any
  onSelectBot?: (botId: string) => void
}) {
  const toolName = getToolName(part)

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
        <div className="my-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <ArrowRightLeftIcon className="size-4 shrink-0" />
          <span>
            Handoff error:{" "}
            {part.errorText || part.output?.error || "Failed to hand off"}
          </span>
        </div>
      )
    }

    return (
      <div className="my-3 overflow-hidden rounded-xl border border-primary/25 bg-primary/5 p-3.5 shadow-xs transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeftIcon className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Task Handoff
                </span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  to {targetName}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Role:{" "}
                <span className="text-foreground font-medium">{targetJob}</span>
              </p>
            </div>
          </div>
          {onSelectBot && targetId && (
            <button
              type="button"
              onClick={() => onSelectBot(targetId)}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <ChatAvatar seed={targetName} className="size-3.5 rounded-xs" />
              <span>Switch to {targetName}</span>
            </button>
          )}
        </div>
        {reason && (
          <div className="mt-2.5 rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground border border-border/50">
            <span className="font-medium text-foreground">Reason: </span>
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
        <div className="my-3 overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3.5 py-2 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-2 text-foreground font-semibold">
              <MonitorIcon className="size-4 text-primary" />
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
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <DownloadIcon className="size-3.5" />
                <span>Save</span>
              </a>
            </div>
          </div>
          <div className="relative aspect-video max-h-[500px] w-full overflow-hidden bg-black/95 flex items-center justify-center p-1">
            <img
              src={screenshotData}
              alt="Sandbox desktop screenshot"
              className="h-full w-full object-contain rounded"
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
        <div className="my-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <MonitorIcon className="size-4 shrink-0" />
          <span>
            Failed to capture screen:{" "}
            {part.errorText || part.output?.error || "Unknown error"}
          </span>
        </div>
      )
    }

    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground animate-pulse">
        <MonitorIcon className="size-4" />
        <span>Capturing desktop screen...</span>
      </div>
    )
  }

  // 3. bash: specialized terminal output
  if (toolName === "bash") {
    const { title } = getToolDisplayInfo(toolName, part.input)
    return (
      <Tool defaultOpen={part.state !== "output-available"} className="my-3">
        <ToolHeader
          title={title}
          type={part.type as any}
          state={part.state}
          toolName={part.type === "dynamic-tool" ? part.toolName : undefined}
        />
        <ToolContent>
          {part.input?.command && (
            <div className="space-y-1.5">
              <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Command
              </h4>
              <div className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-foreground">
                $ {part.input.command}
              </div>
            </div>
          )}
          {part.output?.stdout ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
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

  // 4. All other tools (readFile, writeFile, listFiles, mouse, keyboard)
  const { title } = getToolDisplayInfo(toolName, part.input)
  return (
    <Tool defaultOpen={part.state !== "output-available"} className="my-3">
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

