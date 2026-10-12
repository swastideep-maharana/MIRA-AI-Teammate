"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
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
  SidebarRail,
} from "@/components/ui/sidebar"
import { ChatAvatar } from "@/components/chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import type { UserChatWithBot } from "@/queries/bots"

function formatChatTime(date: Date | string) {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
  } catch {
    return ""
  }
}

export interface AppSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
  chats?: UserChatWithBot[]
}

export function AppSidebar({ chats = [], ...props }: AppSidebarProps) {
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
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

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="flex flex-col gap-2 p-2">
          <div className="flex flex-row items-center justify-end w-full group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    aria-label="Create menu"
                  />
                }
              >
                <PlusIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
                    <PlusIcon />
                    <span>Create new bot</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UsersIcon />
                    <span>Create group chat</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setSearchOpen(true)}
            className="h-8 w-full min-w-0 justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm font-normal text-muted-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0! group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:dark:bg-transparent! group-data-[collapsible=icon]:text-foreground group-data-[collapsible=icon]:hover:bg-sidebar-accent! group-data-[collapsible=icon]:dark:hover:bg-sidebar-accent! group-data-[collapsible=icon]:hover:text-sidebar-accent-foreground!"
          >
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:gap-0">
              <SearchIcon className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Search</span>
            </div>
            <Kbd className="group-data-[collapsible=icon]:hidden text-[10px] tracking-widest font-mono">
              ⌘K
            </Kbd>
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:p-0">
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1">
                {chats.map((chat) => {
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
                        className="h-auto items-start gap-3 p-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center"
                      >
                        <ChatAvatar
                          seed={bot?.avatar || bot?.name || chat.id}
                          className="size-8 shrink-0 rounded-lg mt-0.5 group-data-[collapsible=icon]:size-6 group-data-[collapsible=icon]:mt-0"
                        />
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
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<div />}
                className="h-12 w-full p-0 cursor-pointer group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
              >
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      rootBox: "!flex !w-full !h-full",
                      userButtonTrigger:
                        "!flex !w-full !h-full !items-center !gap-2 !rounded-md !p-2 !text-left !text-sm !text-inherit !bg-transparent hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground active:!bg-sidebar-accent active:!text-sidebar-accent-foreground !cursor-pointer ring-sidebar-ring outline-hidden transition-colors group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center",
                      userButtonBox:
                        "!flex !w-full !h-full !items-center !gap-2 !flex-row group-data-[collapsible=icon]:!justify-center",
                      userButtonOuterIdentifier:
                        "truncate !text-sm !font-medium text-sidebar-foreground group-hover/menu-button:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden !text-left !flex-1",
                      avatarBox:
                        "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !shrink-0 !rounded-md",
                      userButtonAvatarBox:
                        "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !shrink-0 !rounded-md",
                      userButtonAvatarImage:
                        "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !rounded-md",
                    },
                  }}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />

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
                  <ChatAvatar
                    seed={bot?.avatar || bot?.name || chat.id}
                    className="size-7 shrink-0 rounded-md"
                  />
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
