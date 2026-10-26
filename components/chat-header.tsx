"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Monitor } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import type { ChatWithMembers } from "@/queries/chats"
import { cn } from "@/lib/utils"

export interface ChatHeaderProps {
  chat: ChatWithMembers
  isDesktopOpen?: boolean
  onToggleDesktop?: () => void
}

export function ChatHeader({
  chat,
  isDesktopOpen: isDesktopOpenProp,
  onToggleDesktop,
}: ChatHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const bot = chat.members?.[0]?.bot
  const name = bot?.name || chat.name || "Chat"
  const avatarSeed = bot?.avatar || bot?.name || chat.id

  const isDesktopOpenFromUrl = searchParams.get("desktop") === "true"
  const isDesktopOpen = isDesktopOpenProp ?? isDesktopOpenFromUrl

  const handleToggle = () => {
    if (onToggleDesktop) {
      onToggleDesktop()
      return
    }

    const next = new URLSearchParams(searchParams.toString())
    if (isDesktopOpen) {
      next.delete("desktop")
    } else {
      next.set("desktop", "true")
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

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
        variant={isDesktopOpen ? "secondary" : "ghost"}
        size="icon"
        type="button"
        onClick={handleToggle}
        className={cn(
          "size-8 text-muted-foreground hover:text-foreground transition-colors",
          isDesktopOpen && "bg-muted text-foreground"
        )}
        aria-label="Toggle Desktop Panel"
        aria-pressed={isDesktopOpen}
      >
        <Monitor className="size-4" />
      </Button>
    </header>
  )
}


export default ChatHeader
