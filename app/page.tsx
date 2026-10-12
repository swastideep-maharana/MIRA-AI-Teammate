import { UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
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

export default async function Page() {
  await auth.protect()

  const seed = nanoid()

  return (
    <div className="flex min-h-svh flex-col p-6">
      <header className="flex w-full items-center justify-between pb-6 border-b border-border">
        <div className="font-semibold text-lg">Mira AI Teammate</div>
        <div className="flex items-center gap-3">
          <UserButton />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <ChatAvatar seed={seed} className="size-12" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-semibold">
              Meet your first bot
            </EmptyTitle>
            <EmptyDescription>
              Every bot gets its own personality, memory, and face. Spin one
              up and start the conversation.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="secondary">
              <Plus data-icon="inline-start" />
              Create a new bot
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    </div>
  )
}
