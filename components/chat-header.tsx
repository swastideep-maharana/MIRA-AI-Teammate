"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Monitor, MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SandboxVncPreview } from "@/components/sandbox-vnc-preview"
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
  const isMobile = useIsMobile()
  const { open } = useSidebar()

  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [mobileDesktopOpen, setMobileDesktopOpen] = React.useState(false)

  const isGroup = chat.kind === "group" || (chat.members?.length ?? 0) > 1
  const bot = chat.members?.[0]?.bot
  const name = isGroup ? (chat.name || "Group chat") : (bot?.name || chat.name || "Chat")
  const avatarSeed = bot?.avatar || bot?.name || chat.id

  const isDesktopOpenFromUrl = searchParams.get("desktop") === "true"
  const isDesktopOpen = !isGroup && (isDesktopOpenProp ?? isDesktopOpenFromUrl)

  const handleToggle = () => {
    if (isGroup) return

    if (isMobile) {
      setMobileDesktopOpen((prev) => !prev)
      return
    }

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-3 sm:px-4 z-10 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile-only Sidebar Drawer Trigger (on desktop, sidebar icon rail/expanded sidebar handles toggle with no duplicates) */}
          <SidebarTrigger className="md:hidden -ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer rounded-lg shrink-0" />

          {isGroup ? (
            <div className="flex items-center gap-2 min-w-0">
              <GroupChatAvatar
                bots={chat.members?.map((m) => m.bot)}
                className="size-8 rounded-xl shrink-0 shadow-xs border border-border/50"
              />
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-sm text-foreground truncate">{name}</span>
                <span className="text-[11px] text-muted-foreground font-mono bg-muted/70 px-1.5 py-0.5 rounded-md border border-border/60 shrink-0">
                  {chat.members?.length ?? 0} bots
                </span>
              </div>
            </div>
          ) : bot ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <ChatAvatar seed={avatarSeed} className="size-8 rounded-xl shadow-xs border border-border/50" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" title="Online" />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-sm text-foreground truncate">{name}</span>
                  {bot.job && (
                    <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline-block truncate">
                      • {bot.job}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              <ChatAvatar seed={avatarSeed} className="size-8 rounded-xl shrink-0 shadow-xs border border-border/50" />
              <span className="text-sm font-semibold text-foreground truncate">{name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mobile-only Theme Toggle (on desktop, ThemeToggle is in sidebar footer) */}
          <div className="md:hidden">
            <ThemeToggle />
          </div>

          {/* Desktop panel option is hidden for group chats */}
          {!isGroup && (
            <Button
              variant={isDesktopOpen || mobileDesktopOpen ? "secondary" : "ghost"}
              size="icon"
              type="button"
              onClick={handleToggle}
              className={cn(
                "size-8 rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer",
                (isDesktopOpen || mobileDesktopOpen) &&
                  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 shadow-xs"
              )}
              aria-label={
                isDesktopOpen || mobileDesktopOpen
                  ? "Close remote desktop preview"
                  : "Open remote desktop preview"
              }
              aria-pressed={isDesktopOpen || mobileDesktopOpen}
              title={
                isDesktopOpen || mobileDesktopOpen
                  ? "Close remote desktop preview"
                  : "Open remote desktop preview"
              }
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
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                    aria-label="Chat options"
                    title="Chat options"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 border-border bg-popover text-popover-foreground shadow-xl p-1">
                <DropdownMenuItem
                  onClick={() => setEditDialogOpen(true)}
                  className="gap-2 cursor-pointer rounded-md py-2 hover:bg-accent/60"
                >
                  <Pencil className="size-4 text-muted-foreground" />
                  <span>{isGroup ? "Edit team chat" : "Edit bot profile"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowDeleteAlert(true)}
                  className="gap-2 cursor-pointer rounded-md py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10"
                >
                  <Trash2 className="size-4" />
                  <span>
                    {isGroup ? "Delete team chat" : "Delete bot"}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Edge-to-Edge Mobile Modal Sheet for Daytona Desktop */}
      {isMobile && !isGroup && (
        <Sheet open={mobileDesktopOpen} onOpenChange={setMobileDesktopOpen}>
          <SheetContent
            side="bottom"
            className="h-[88svh] p-0 rounded-t-2xl border-t border-border bg-background overflow-hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{name} Daytona Remote Desktop</SheetTitle>
            </SheetHeader>
            <div className="h-full w-full min-h-0">
              <SandboxVncPreview
                sandboxId={bot?.sandboxId}
                botName={bot?.name}
                className="border-l-0"
                onClose={() => setMobileDesktopOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

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
        <AlertDialogContent className="border-border bg-popover text-popover-foreground shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {isGroup ? "team chat" : "bot"} "{name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isGroup
                ? "This will permanently delete this team chat and its conversation history. The participating bots will remain untouched."
                : "This will permanently delete this bot, its sandbox environment, and all related chat history. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-border hover:bg-accent/60 cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
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
