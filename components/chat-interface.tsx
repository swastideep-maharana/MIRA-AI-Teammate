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
import { ChatAvatar } from "@/components/chat-avatar"
import { Spinner } from "@/components/ui/spinner"

export interface ChatProps {
  chatId: string
  bot?: {
    name?: string | null
    avatar?: string | null
    job?: string | null
    instructions?: string | null
  } | null
}

export function ChatInterface({ chatId, bot }: ChatProps) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
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
      <Conversation className="flex-1 overflow-y-auto">
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
                  <MessageContent>
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={index}>
                            {part.text}
                          </MessageResponse>
                        )
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

      <div className="border-t bg-background/95 backdrop-blur-sm p-4">
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
