import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { nanoid } from "nanoid"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ChatAvatar } from "@/components/chat-avatar"
import { BotDialog } from "@/components/bot-dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

export const maxDuration = 60

export default async function Page() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const seed = nanoid()

  return (
    <div className="flex flex-1 flex-col h-full min-h-svh bg-background text-foreground transition-colors">
      {/* Mobile top-bar with accessible drawer trigger */}
      <div className="flex h-13 md:hidden items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer rounded-lg" />
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
            <span className="font-mono text-sm font-semibold tracking-wider text-foreground">MIRA</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Empty className="rounded-2xl border border-border bg-card p-8 max-w-md shadow-xl text-card-foreground">
          <EmptyHeader>
            <EmptyMedia className="mb-4">
              <div className="size-16 rounded-2xl bg-muted border border-border flex items-center justify-center shadow-md">
                <ChatAvatar seed={seed} className="size-12" />
              </div>
            </EmptyMedia>
            <EmptyTitle className="text-lg font-semibold text-foreground">
              Meet your first AI teammate
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Every teammate gets its own personality, memory, and dedicated Daytona cloud sandbox with full computer use.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-5">
            <BotDialog
              trigger={
                <Button className="h-9 px-4 text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-slate-950 cursor-pointer shadow-xs">
                  <Plus data-icon="inline-start" className="size-3.5" />
                  Create AI Teammate
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      </div>
    </div>
  )
}
