import { notFound, redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { getChat, getChatMessages } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { ChatInterface } from "@/components/chat-interface"
import { SandboxVncPreview } from "@/components/sandbox-vnc-preview"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export const maxDuration = 60

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>
  searchParams: Promise<{ desktop?: string }>
}) {
  const { chatId } = await params
  const { desktop } = await searchParams

  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const [chat, initialMessages] = await Promise.all([
    getChat(chatId),
    getChatMessages(chatId),
  ])

  if (!chat) {
    notFound()
  }

  const isGroup = chat.kind === "group" || (chat.members?.length ?? 0) > 1
  const isDesktopOpen = !isGroup && desktop === "true"

  const bot = chat.members?.[0]?.bot
  const bots = chat.members?.map((m) => m.bot) ?? []

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden bg-background text-foreground transition-colors">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full w-full min-h-0 overflow-hidden"
      >
        <ResizablePanel
          defaultSize={isDesktopOpen ? 55 : 100}
          minSize={35}
          maxSize={isDesktopOpen ? 65 : 100}
          className="h-full min-h-0 overflow-hidden flex flex-col"
        >
          <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden">
            <ChatHeader chat={chat} isDesktopOpen={isDesktopOpen} />
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <ChatInterface
                chatId={chatId}
                bot={bot}
                chat={chat}
                bots={bots}
                initialMessages={initialMessages}
              />
            </div>
          </div>
        </ResizablePanel>
        {isDesktopOpen && (
          <>
            <ResizableHandle
              withHandle
              className="hidden md:flex bg-border/40 hover:bg-cyan-500/50 transition-colors"
            />
            <ResizablePanel
              defaultSize={45}
              minSize={35}
              maxSize={65}
              className="hidden md:block bg-background h-full min-h-0 overflow-hidden"
            >
              <SandboxVncPreview
                sandboxId={bot?.sandboxId}
                botName={bot?.name}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
