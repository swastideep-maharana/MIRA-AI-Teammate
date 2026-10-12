"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Monitor } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import type { ChatWithMembers } from "@/queries/chats"

export interface ChatHeaderProps {
  chat: ChatWithMembers
}

export function ChatHeader({ chat }: ChatHeaderProps) {
  const router = useRouter()
  const bot = chat.members?.[0]?.bot
  const name = bot?.name || chat.name || "Chat"
  const avatarSeed = bot?.avatar || bot?.name || chat.id

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      {bot ? (
        <BotDialog
          bot={bot}
          onUpdated={() => router.refresh()}
          onDeleted={() => {
            router.push("/")
            router.refresh()
          }}
          trigger={
            <Button
              variant="ghost"
              className="h-auto -ml-2 gap-2 px-2 py-1 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <ChatAvatar seed={avatarSeed} className="size-5 rounded-sm" />
              <span>{name}</span>
            </Button>
          }
        />
      ) : (
        <div className="flex items-center gap-2">
          <ChatAvatar seed={avatarSeed} className="size-5 rounded-sm" />
          <span className="text-sm font-medium">{name}</span>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label="Desktop"
      >
        <Monitor className="size-4" />
      </Button>
    </header>
  )
}

export default ChatHeader
