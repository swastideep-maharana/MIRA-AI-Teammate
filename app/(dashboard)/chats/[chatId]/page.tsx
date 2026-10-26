import { notFound } from "next/navigation"
import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { ChatInterface } from "@/components/chat-interface"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  const chat = await getChat(chatId)

  if (!chat) {
    notFound()
  }

  const bot = chat.members?.[0]?.bot

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden">
      <ChatHeader chat={chat} />
      <ChatInterface chatId={chatId} bot={bot} />
    </div>
  )
}
