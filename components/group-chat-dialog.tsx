"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { ChatAvatar } from "@/components/chat-avatar"
import { toast } from "@/components/ui/toast"
import { createGroupChat, getUserBotsAction } from "@/actions/group-chat"
import type { Bot } from "@/db/schema"

export interface GroupChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialBots?: Bot[]
}

export function GroupChatDialog({
  open,
  onOpenChange,
  initialBots = [],
}: GroupChatDialogProps) {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [bots, setBots] = React.useState<Bot[]>(initialBots)
  const [selectedBotIds, setSelectedBotIds] = React.useState<string[]>([])
  const [isLoadingBots, setIsLoadingBots] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Fetch or refresh bots when dialog opens
  React.useEffect(() => {
    if (!open) {
      setName("")
      setSelectedBotIds([])
      return
    }

    if (initialBots.length > 0) {
      setBots(initialBots)
    } else {
      setIsLoadingBots(true)
      getUserBotsAction()
        .then((userBots) => {
          setBots(userBots)
        })
        .catch((err) => {
          console.error("Failed to load bots:", err)
        })
        .finally(() => {
          setIsLoadingBots(false)
        })
    }
  }, [open, initialBots])

  const toggleBot = (botId: string) => {
    setSelectedBotIds((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.add({
        title: "Name required",
        description: "Please enter a group name.",
        type: "error",
      })
      return
    }

    if (selectedBotIds.length === 0) {
      toast.add({
        title: "Select bots",
        description: "Please pick at least one bot for the group.",
        type: "error",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const newChat = await createGroupChat({
        name: trimmedName,
        botIds: selectedBotIds,
      })

      toast.add({
        title: "Group created",
        description: `Group chat "${trimmedName}" created successfully.`,
        type: "success",
      })

      onOpenChange(false)
      setName("")
      setSelectedBotIds([])
      router.push(`/chats/${newChat.id}`)
      router.refresh()
    } catch (error: any) {
      toast.add({
        title: "Failed to create group",
        description: error?.message || "Something went wrong. Please try again.",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-5">
        <DialogHeader className="gap-1.5 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            New group chat
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Group Name Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="group-name"
              className="text-xs font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekend plans"
              className="h-9 text-sm"
              maxLength={64}
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {/* Bots Selection Field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-foreground">
              Bots
            </label>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-border/80 bg-muted/20 p-1 flex flex-col gap-1">
              {isLoadingBots ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Spinner className="size-4" />
                  <span>Loading bots...</span>
                </div>
              ) : bots.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground text-center px-4">
                  No bots found. Create a bot first before creating a group chat.
                </div>
              ) : (
                bots.map((bot) => {
                  const isChecked = selectedBotIds.includes(bot.id)
                  return (
                    <div
                      key={bot.id}
                      onClick={() => toggleBot(bot.id)}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/60 cursor-pointer select-none transition-colors"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleBot(bot.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <ChatAvatar
                        seed={bot.avatar || bot.name}
                        className="size-6 rounded-sm shrink-0"
                      />
                      <div className="flex flex-1 items-center justify-between min-w-0">
                        <span className="text-sm font-medium truncate text-foreground">
                          {bot.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate ml-2">
                          {bot.job}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Dialog Footer Actions */}
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim() || selectedBotIds.length === 0}
              className="text-xs h-8 font-medium gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="size-3.5" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create group</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default GroupChatDialog
