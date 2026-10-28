"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Monitor, MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { deleteBot } from "@/actions/bot"
import { deleteGroupChat } from "@/actions/group-chat"
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

  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const isGroup = chat.kind === "group" || (chat.members?.length ?? 0) > 1
  const bot = chat.members?.[0]?.bot
  const name = isGroup ? (chat.name || "Group chat") : (bot?.name || chat.name || "Chat")
  const avatarSeed = bot?.avatar || bot?.name || chat.id

  const isDesktopOpenFromUrl = searchParams.get("desktop") === "true"
  const isDesktopOpen = !isGroup && (isDesktopOpenProp ?? isDesktopOpenFromUrl)

  const handleToggle = () => {
    if (isGroup) return

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

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      if (isGroup) {
        await deleteGroupChat(chat.id)
        toast.add({
          title: "Team chat deleted",
          description: `Group chat "${name}" was deleted.`,
          type: "success",
        })
      } else if (bot) {
        await deleteBot(bot.id)
        toast.add({
          title: "Bot deleted",
          description: `${name} was deleted.`,
          type: "success",
        })
      }
      setShowDeleteAlert(false)
      router.push("/")
      router.refresh()
    } catch (error: any) {
      toast.add({
        title: isGroup ? "Failed to delete team chat" : "Failed to delete bot",
        description: error?.message || "An error occurred while deleting.",
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        {isGroup ? (
          <Button
            variant="ghost"
            onClick={() => setEditDialogOpen(true)}
            className="h-auto -ml-2 gap-2 px-2 py-1 text-sm font-medium text-foreground hover:bg-muted/50 cursor-pointer"
          >
            <GroupChatAvatar
              bots={chat.members?.map((m) => m.bot)}
              className="size-5 rounded-sm shrink-0"
            />
            <span className="font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({chat.members?.length ?? 0})
            </span>
          </Button>
        ) : bot ? (
          <Button
            variant="ghost"
            onClick={() => setEditDialogOpen(true)}
            className="h-auto -ml-2 gap-2 px-2 py-1 text-sm font-medium text-foreground hover:bg-muted/50 cursor-pointer"
          >
            <ChatAvatar seed={avatarSeed} className="size-5 rounded-sm" />
            <span>{name}</span>
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <ChatAvatar seed={avatarSeed} className="size-5 rounded-sm" />
            <span className="text-sm font-medium">{name}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Desktop panel option is hidden for group chats */}
          {!isGroup && (
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
              title={isDesktopOpen ? "Close desktop screen" : "Open desktop screen"}
            >
              <Monitor className="size-4" />
            </Button>
          )}

          {/* Options Menu with Edit & Delete */}
          {(isGroup || bot) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="size-8 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Chat options"
                    title="Chat options"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="size-4" />
                  <span>{isGroup ? "Edit team chat" : "Edit bot"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 className="size-4 text-destructive" />
                  <span className="text-destructive">
                    {isGroup ? "Delete team chat" : "Delete bot"}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Edit Dialogs */}
      {isGroup ? (
        <GroupChatDialog
          chat={chat}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUpdated={() => {
            setEditDialogOpen(false)
            router.refresh()
          }}
          onDeleted={() => {
            setEditDialogOpen(false)
            router.push("/")
            router.refresh()
          }}
        />
      ) : bot ? (
        <BotDialog
          bot={bot}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUpdated={() => {
            setEditDialogOpen(false)
            router.refresh()
          }}
          onDeleted={() => {
            setEditDialogOpen(false)
            router.push("/")
            router.refresh()
          }}
        />
      ) : null}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {isGroup ? "team chat" : "bot"} "{name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGroup
                ? "This will permanently delete this team chat and its conversation history. The participating bots will remain untouched."
                : "This will permanently delete this bot, its sandbox environment, and all related chat history. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Spinner data-icon="inline-start" />}
              {isGroup ? "Delete team chat" : "Delete bot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default ChatHeader
