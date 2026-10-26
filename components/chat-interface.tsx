"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import {
  useTriggerChatTransport,
  useLoadTranscript,
} from "@trigger.dev/sdk/chat/react"
import type { chatAgent } from "@/src/trigger/chat"
import {
  mintChatAccessToken,
  startChatSession,
  loadChatTranscript,
} from "@/app/actions/chat"

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
} from "@/components/ai-elements/prompt-input"
import { isToolUIPart } from "ai"
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
  KeyboardIcon,
  MonitorIcon,
  DownloadIcon,
  WrenchIcon,
} from "lucide-react"
import { ChatAvatar } from "@/components/chat-avatar"
import { Spinner } from "@/components/ui/spinner"

export interface ChatProps {
  chatId: string
  bot?: {
    name?: string | null
    avatar?: string | null
    job?: string | null
    instructions?: string | null
    sandboxId?: string | null
  } | null
}

export function ChatInterface({ chatId, bot }: ChatProps) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData: {
      botName: bot?.name ?? "AI Teammate",
      botJob: bot?.job ?? "AI Assistant",
      botInstructions: bot?.instructions ?? "",
      sandboxId: bot?.sandboxId ?? "",
    },
  })

  const { messages: initialMessages, isLoading } = useLoadTranscript(
    chatId,
    loadChatTranscript,
    { transport }
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <ChatView
      chatId={chatId}
      bot={bot}
      transport={transport}
      initialMessages={initialMessages}
    />
  )
}

function ChatView({
  chatId,
  bot,
  transport,
  initialMessages,
}: {
  chatId: string
  bot?: ChatProps["bot"]
  transport: ReturnType<typeof useTriggerChatTransport>
  initialMessages: UIMessage[]
}) {
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })

  const botName = bot?.name || "AI Teammate"
  const botAvatar = bot?.avatar || bot?.name || chatId
  const isGenerating = status === "submitted" || status === "streaming"

  return (
    <div className="relative flex flex-1 flex-col h-full min-h-0 overflow-hidden bg-background">
      <Conversation className="flex-1 min-h-0 overflow-y-auto">
        <ConversationContent className="mx-auto w-full max-w-3xl py-6 px-4 space-y-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                <ChatAvatar
                  seed={botAvatar}
                  className="size-12 rounded-xl mb-3 shadow-sm"
                />
              }
              title={`Talk with ${botName}`}
              description={
                bot?.job
                  ? `${bot.job} — Ready to help you with your work.`
                  : "Send a message to start chatting."
              }
            />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex w-full gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <ChatAvatar
                    seed={botAvatar}
                    className="size-7 rounded-sm shrink-0 mt-1 shadow-xs"
                  />
                )}
                <Message
                  from={message.role}
                  className={
                    message.role === "user" ? "max-w-[80%]" : "max-w-[90%]"
                  }
                >
                  <MessageContent className="w-full">
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        if (!part.text?.trim()) return null
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
                        return <ToolPartView key={index} part={part} />
                      }

                      return null
                    })}
                  </MessageContent>
                </Message>
              </div>
            ))
          )}

          {status === "submitted" && (
            <div className="flex w-full items-center gap-3 text-muted-foreground text-sm pl-1">
              <ChatAvatar
                seed={botAvatar}
                className="size-7 rounded-sm shrink-0 shadow-xs"
              />
              <span className="inline-flex items-center gap-1.5 animate-pulse font-medium">
                Thinking...
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message ||
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
              sendMessage({ text: trimmed })
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={`Message ${botName}...`}
                className="min-h-12 max-h-48 resize-none"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
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
    default:
      return {
        title: toolName,
        icon: WrenchIcon,
      }
  }
}

export function ToolPartView({ part }: { part: any }) {
  const toolName = getToolName(part)

  // 1. viewScreen: "never rendered in chat"
  if (toolName === "viewScreen") {
    return null
  }

  // 2. showScreen: "rendered in chat"
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

