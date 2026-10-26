"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { ChatAvatar } from "@/components/chat-avatar"
import { toast } from "@/components/ui/toast"
import {
  createGroupChat,
  updateGroupChat,
  deleteGroupChat,
  getUserBotsAction,
} from "@/actions/group-chat"
import type { Bot } from "@/db/schema"
import type { ChatWithMembers } from "@/queries/chats"

export interface GroupChatDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  initialBots?: Bot[]
  chat?: ChatWithMembers | null
  onCreated?: (chat: any) => void
  onUpdated?: () => void
  onDeleted?: () => void
}

export function GroupChatDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  initialBots = [],
  chat,
  onCreated,
  onUpdated,
  onDeleted,
}: GroupChatDialogProps) {
  const router = useRouter()
  const isEditing = Boolean(chat)

  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const [name, setName] = React.useState(() => chat?.name ?? "")
  const [bots, setBots] = React.useState<Bot[]>(initialBots)
  const [selectedBotIds, setSelectedBotIds] = React.useState<string[]>(() => {
    return chat?.members?.map((m) => m.botId) ?? []
  })
  const [isLoadingBots, setIsLoadingBots] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Sync state when dialog opens or chat prop changes
  React.useEffect(() => {
    if (!open) {
      if (!isEditing) {
        setName("")
        setSelectedBotIds([])
      }
      return
    }

    if (chat) {
      setName(chat.name || "")
      setSelectedBotIds(chat.members?.map((m) => m.botId) || [])
    } else {
      setName("")
      setSelectedBotIds([])
    }

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
  }, [open, chat, isEditing])

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
      if (isEditing && chat) {
        await updateGroupChat(chat.id, {
          name: trimmedName,
          botIds: selectedBotIds,
        })

        toast.add({
          title: "Group updated",
          description: `Group chat "${trimmedName}" updated successfully.`,
          type: "success",
        })

        setOpen(false)
        onUpdated?.()
        router.refresh()
      } else {
        const newChat = await createGroupChat({
          name: trimmedName,
          botIds: selectedBotIds,
        })

        toast.add({
          title: "Group created",
          description: `Group chat "${trimmedName}" created successfully.`,
          type: "success",
        })

        setOpen(false)
        setName("")
        setSelectedBotIds([])
        onCreated?.(newChat)
        router.push(`/chats/${newChat.id}`)
        router.refresh()
      }
    } catch (error: any) {
      toast.add({
        title: isEditing ? "Failed to update group" : "Failed to create group",
        description: error?.message || "Something went wrong. Please try again.",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!chat) return
    setIsDeleting(true)

    try {
      await deleteGroupChat(chat.id)
      toast.add({
        title: "Group deleted",
        description: `Group chat "${chat.name || "Group"}" was deleted.`,
        type: "success",
      })

      setShowDeleteAlert(false)
      setOpen(false)
      onDeleted?.()
    } catch (error: any) {
      toast.add({
        title: "Failed to delete group",
        description: error?.message || "Something went wrong.",
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
        <DialogContent className="sm:max-w-md gap-5">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isEditing ? "Edit group chat" : "New group chat"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isEditing
                ? "Update group name, add or remove bots, or delete this group chat."
                : "Name the group and pick which bots are in it."}
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
                placeholder="Team brainstorm"
                className="h-9 text-sm"
                maxLength={64}
                autoFocus
                disabled={isSubmitting || isDeleting}
              />
            </div>

            {/* Bots Selection Field */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  Bots ({selectedBotIds.length} selected)
                </label>
                {bots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBotIds.length === bots.length) {
                        setSelectedBotIds([])
                      } else {
                        setSelectedBotIds(bots.map((b) => b.id))
                      }
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {selectedBotIds.length === bots.length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-border/80 bg-muted/20 p-1 flex flex-col gap-1">
                {isLoadingBots ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                    <Spinner className="size-4" />
                    <span>Loading bots...</span>
                  </div>
                ) : bots.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground text-center px-4">
                    No bots found. Create a bot first.
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
            <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting || isDeleting}
                  onClick={() => setShowDeleteAlert(true)}
                  className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 px-2"
                >
                  <Trash2Icon className="size-3.5" />
                  <span>Delete group</span>
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting || isDeleting}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isSubmitting ||
                    isDeleting ||
                    !name.trim() ||
                    selectedBotIds.length === 0
                  }
                  className="text-xs h-8 font-medium gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="size-3.5" />
                      <span>{isEditing ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    <span>{isEditing ? "Save changes" : "Create group"}</span>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Chat Confirmation */}
      {isEditing && (
        <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {chat?.name ? `"${chat.name}"` : "group chat"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this group chat and its message
                history. The participating bots will remain untouched. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting && <Spinner data-icon="inline-start" />}
                Delete group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

export default GroupChatDialog
