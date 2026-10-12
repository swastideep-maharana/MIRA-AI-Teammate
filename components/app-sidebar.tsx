"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PlusIcon, UsersIcon } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const pathname = usePathname()

  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader className="flex flex-row items-center justify-end p-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
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
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => {
                  const bot = chat.members[0]?.bot
                  const name = chat.name || bot?.name || "Chat"
                  const time = formatChatTime(chat.lastMessageAt)
                  const preview = chat.lastMessagesPreview
                  const isActive = pathname === `/chat/${chat.id}`

                  return (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        render={<Link href={`/chat/${chat.id}`} />}
                        isActive={isActive}
                        className="h-auto items-start gap-3 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5"
                      >
                        <ChatAvatar
                          seed={bot?.avatar || bot?.name || chat.id}
                          className="size-8 shrink-0 rounded-lg mt-0.5"
                        />
                        <div className="flex flex-1 min-w-0 flex-col gap-0.5 overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-sm text-sidebar-foreground">
                              {name}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground font-normal">
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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<div />}
                className="h-12 w-full p-0 cursor-pointer"
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
      </Sidebar>

      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
    </>
  )
}
