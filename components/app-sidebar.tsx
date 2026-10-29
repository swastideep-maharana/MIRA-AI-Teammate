"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
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
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { deleteBot } from "@/actions/bot"
import { deleteGroupChat } from "@/actions/group-chat"
import type { UserChatWithBot } from "@/queries/bots"
import type { Bot } from "@/db/schema"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

function formatChatTime(date: Date | string) {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
  } catch {
    return ""
  }
}

function SidebarUserButton() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex w-full h-full items-center gap-2 p-2">
        <div className="size-6 rounded-md bg-muted animate-pulse shrink-0" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse group-data-[collapsible=icon]:hidden" />
      </div>
    )
  }

  return (
    <UserButton
      showName
      signInUrl="/sign-in"
      appearance={{
        elements: {
          rootBox: "!flex !w-full !h-full",
          userButtonTrigger:
            "!flex !w-full !h-full !items-center !gap-2 !flex-row !rounded-md !p-2 !text-left !text-sm !text-inherit !bg-transparent hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground active:!bg-sidebar-accent active:!text-sidebar-accent-foreground !cursor-pointer ring-sidebar-ring outline-hidden transition-colors group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center",
          userButtonBox:
            "!flex !items-center !gap-2 !order-1 !shrink-0 group-data-[collapsible=icon]:!justify-center",
          userButtonOuterIdentifier:
            "!order-2 truncate !text-sm !font-medium text-sidebar-foreground group-hover/menu-button:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden !text-left !flex-1 min-w-0",
          avatarBox:
            "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !shrink-0 !rounded-md",
          userButtonAvatarBox:
            "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !shrink-0 !rounded-md",
          userButtonAvatarImage:
            "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !rounded-md",
        },
      }}
    />
  )
}

export interface AppSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
  chats?: UserChatWithBot[]
  bots?: Bot[]
}

export function AppSidebar({ chats = [], bots = [], ...props }: AppSidebarProps) {
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [groupChatDialogOpen, setGroupChatDialogOpen] = React.useState(false)
  const [editingBot, setEditingBot] = React.useState<Bot | null>(null)
  const [editingGroupChat, setEditingGroupChat] = React.useState<UserChatWithBot | null>(null)
  const [targetToDelete, setTargetToDelete] = React.useState<{
    id: string
    name: string
    isGroup: boolean
    chatId: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!targetToDelete) return
    setIsDeleting(true)
    try {
      if (targetToDelete.isGroup) {
        await deleteGroupChat(targetToDelete.id)
        toast.add({
          title: "Team chat deleted",
          description: `"${targetToDelete.name}" was deleted.`,
          type: "success",
        })
      } else {
        await deleteBot(targetToDelete.id)
        toast.add({
          title: "Bot deleted",
          description: `"${targetToDelete.name}" was deleted.`,
          type: "success",
        })
      }
      const deletedChatId = targetToDelete.chatId
      setTargetToDelete(null)
      if (pathname === `/chats/${deletedChatId}`) {
        router.push("/")
      }
      router.refresh()
    } catch (error: any) {
      toast.add({
        title: targetToDelete.isGroup ? "Failed to delete team chat" : "Failed to delete bot",
        description: error?.message || "An error occurred while deleting.",
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" {...props}>
        <SidebarHeader className="flex flex-col gap-2.5 p-3 border-b border-sidebar-border">
          <div className="flex flex-row items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-sm text-sidebar-foreground tracking-tight group-data-[collapsible=icon]:hidden hover:opacity-85 transition-opacity"
            >
              <span className="size-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
              <span className="font-mono tracking-wider font-semibold">MIRA</span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-sidebar-accent border border-sidebar-border">
                teammates
              </span>
            </Link>

            <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
              <SidebarTrigger
                title="Toggle sidebar"
                className="size-8 rounded-lg bg-transparent hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-cyan-500/50 cursor-pointer"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg bg-transparent hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-cyan-500/50 cursor-pointer"
                      aria-label="Create bot or team chat"
                      title="Create bot or team chat"
                    />
                  }
                >
                  <PlusIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-border bg-popover text-popover-foreground shadow-xl p-1">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setBotDialogOpen(true)} className="gap-2 cursor-pointer py-2 hover:bg-accent/60">
                      <PlusIcon className="size-4 text-cyan-500" />
                      <span>Create new bot</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setGroupChatDialogOpen(true)} className="gap-2 cursor-pointer py-2 hover:bg-accent/60">
                      <UsersIcon className="size-4 text-cyan-500" />
                      <span>Create team chat</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setSearchOpen(true)}
            className="h-8 w-full min-w-0 justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1 text-xs font-normal text-muted-foreground shadow-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0! group-data-[collapsible=icon]:bg-transparent!"
          >
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:gap-0">
              <SearchIcon className="size-3.5 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Quick find...</span>
            </div>
            <Kbd className="group-data-[collapsible=icon]:hidden text-[10px] tracking-widest font-mono bg-sidebar-accent border-sidebar-border text-muted-foreground">
              ⌘K
            </Kbd>
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:p-0">
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1">
                {chats.map((chat) => {
                  const isGroup = chat.kind === "group" || chat.members.length > 1
                  const bot = chat.members[0]?.bot
                  const name = chat.name || bot?.name || "Chat"
                  const time = formatChatTime(chat.lastMessageAt)
                  const preview = chat.lastMessagesPreview
                  const isActive = pathname === `/chats/${chat.id}`

                  return (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        render={<Link href={`/chats/${chat.id}`} />}
                        isActive={isActive}
                        tooltip={name}
                        className={cn(
                          "h-auto items-start gap-3 p-2 pr-8 rounded-xl transition-all duration-150 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border border-sidebar-border shadow-xs"
                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        )}
                      >
                        {isGroup ? (
                          <GroupChatAvatar
                            bots={chat.members.map((m) => m.bot)}
                            className="size-8 shrink-0 rounded-lg mt-0.5 group-data-[collapsible=icon]:size-6 group-data-[collapsible=icon]:mt-0"
                          />
                        ) : (
                          <ChatAvatar
                            seed={bot?.avatar || bot?.name || chat.id}
                            className="size-8 shrink-0 rounded-lg mt-0.5 group-data-[collapsible=icon]:size-6 group-data-[collapsible=icon]:mt-0"
                          />
                        )}
                        <div className="flex flex-1 min-w-0 flex-col gap-0.5 overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-sm text-sidebar-foreground">
                              {name}
                            </span>
                            <span
                              suppressHydrationWarning
                              className="shrink-0 text-xs text-muted-foreground font-normal"
                            >
                              {time}
                            </span>
                          </div>
                          {preview && (
                            <span className="truncate text-xs text-muted-foreground font-normal">
                              {preview}
                            </span>
                          )}
                        </div>
                      </SidebarMenuButton>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              showOnHover
                              className="text-muted-foreground hover:text-foreground cursor-pointer"
                              aria-label={`Options for ${name}`}
                            />
                          }
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => {
                              if (isGroup) {
                                setEditingGroupChat(chat)
                              } else if (bot) {
                                setEditingBot(bot)
                              }
                            }}
                          >
                            <PencilIcon className="size-4" />
                            <span>{isGroup ? "Edit group" : "Edit bot"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setTargetToDelete({
                                id: isGroup ? chat.id : (bot?.id || ""),
                                name,
                                isGroup,
                                chatId: chat.id,
                              })
                            }}
                          >
                            <Trash2Icon className="size-4 text-destructive" />
                            <span className="text-destructive">
                              {isGroup ? "Delete team chat" : "Delete bot"}
                            </span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                size="lg"
                render={<div />}
                className="h-10 w-full p-0 cursor-pointer group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
              >
                <SidebarUserButton />
              </SidebarMenuButton>
            </div>
            <div className="shrink-0 flex items-center justify-center">
              <ThemeToggle />
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <GroupChatDialog
        open={groupChatDialogOpen}
        onOpenChange={setGroupChatDialogOpen}
        initialBots={bots}
      />

      {/* Editing Dialogs */}
      <BotDialog
        open={Boolean(editingBot)}
        onOpenChange={(open) => !open && setEditingBot(null)}
        bot={editingBot}
        onUpdated={() => {
          setEditingBot(null)
          router.refresh()
        }}
        onDeleted={() => {
          const deletedBotId = editingBot?.id
          setEditingBot(null)
          if (deletedBotId) {
            router.push("/")
          }
          router.refresh()
        }}
      />
      <GroupChatDialog
        open={Boolean(editingGroupChat)}
        onOpenChange={(open) => !open && setEditingGroupChat(null)}
        chat={editingGroupChat as any}
        initialBots={bots}
        onUpdated={() => {
          setEditingGroupChat(null)
          router.refresh()
        }}
        onDeleted={() => {
          setEditingGroupChat(null)
          router.push("/")
          router.refresh()
        }}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(targetToDelete)}
        onOpenChange={(open) => !open && !isDeleting && setTargetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {targetToDelete?.isGroup ? "team chat" : "bot"} "{targetToDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetToDelete?.isGroup
                ? "This will permanently delete this team chat and all of its conversation history. The participating bots will remain untouched."
                : "This will permanently delete this bot, its sandbox environment, and all related chat history. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting && <Spinner data-icon="inline-start" />}
              {targetToDelete?.isGroup ? "Delete team chat" : "Delete bot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search chats"
        description="Search for a chat to open..."
      >
        <CommandInput placeholder="Search chats..." />
        <CommandList>
          <CommandEmpty>No chats found.</CommandEmpty>
          <CommandGroup heading="Chats">
            {chats.map((chat) => {
              const isGroup = chat.kind === "group" || chat.members.length > 1
              const bot = chat.members[0]?.bot
              const name = chat.name || bot?.name || "Chat"
              return (
                <CommandItem
                  key={chat.id}
                  value={`${name} ${chat.lastMessagesPreview || ""}`}
                  onSelect={() => {
                    setSearchOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                  className="flex items-center gap-2.5 cursor-pointer py-2 px-2.5 rounded-lg"
                >
                  {isGroup ? (
                    <GroupChatAvatar
                      bots={chat.members.map((m) => m.bot)}
                      className="size-7 shrink-0 rounded-md"
                    />
                  ) : (
                    <ChatAvatar
                      seed={bot?.avatar || bot?.name || chat.id}
                      className="size-7 shrink-0 rounded-md"
                    />
                  )}
                  <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                    <span className="truncate font-medium text-sm leading-tight">
                      {name}
                    </span>
                    {chat.lastMessagesPreview && (
                      <span className="truncate text-xs text-muted-foreground leading-normal">
                        {chat.lastMessagesPreview}
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
