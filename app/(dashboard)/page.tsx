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

export const maxDuration = 60

export default async function Page() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const seed = nanoid()

  return (
    <div className="flex flex-1 items-center justify-center p-6 min-h-svh">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ChatAvatar seed={seed} className="size-12" />
          </EmptyMedia>
          <EmptyTitle className="text-base font-semibold">
            Meet your first bot
          </EmptyTitle>
          <EmptyDescription>
            Every bot gets its own personality, memory, and face. Spin one up
            and start the conversation.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog
            trigger={
              <Button variant="secondary">
                <Plus data-icon="inline-start" />
                Create a new bot
              </Button>
            }
          />
        </EmptyContent>
      </Empty>
    </div>
  )
}
