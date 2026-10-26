import { notFound } from "next/navigation"
import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { ChatInterface } from "@/components/chat-interface"
import { SandboxVncPreview } from "@/components/sandbox-vnc-preview"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>
  searchParams: Promise<{ desktop?: string }>
}) {
  const { chatId } = await params
  const { desktop } = await searchParams

  const chat = await getChat(chatId)

  if (!chat) {
    notFound()
  }

  const isGroup = chat.kind === "group" || (chat.members?.length ?? 0) > 1
  const isDesktopOpen = !isGroup && desktop === "true"

  const bot = chat.members?.[0]?.bot
  const bots = chat.members?.map((m) => m.bot) ?? []

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full w-full min-h-0 overflow-hidden"
      >
        <ResizablePanel
          defaultSize={isDesktopOpen ? "60%" : "100%"}
          minSize="30%"
          className="h-full min-h-0 overflow-hidden"
        >
          <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden">
            <ChatHeader chat={chat} isDesktopOpen={isDesktopOpen} />
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <ChatInterface
                chatId={chatId}
                bot={bot}
                chat={chat}
                bots={bots}
              />
            </div>
          </div>
        </ResizablePanel>
        {isDesktopOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize="40%"
              minSize="20%"
              className="bg-background h-full min-h-0 overflow-hidden"
            >
              <SandboxVncPreview sandboxId={bot?.sandboxId} botName={bot?.name} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
