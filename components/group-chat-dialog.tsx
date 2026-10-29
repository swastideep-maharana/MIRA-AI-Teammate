"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon, Users, Check, Sparkles } from "lucide-react"

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
import { cn } from "@/lib/utils"

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
          title: "Team chat updated",
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
          title: "Team chat created",
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
        title: isEditing ? "Failed to update team chat" : "Failed to create team chat",
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
        title: "Team chat deleted",
        description: `Group chat "${chat.name || "Group"}" was deleted.`,
        type: "success",
      })

      setShowDeleteAlert(false)
      setOpen(false)
      onDeleted?.()
    } catch (error: any) {
      toast.add({
        title: "Failed to delete team chat",
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
        <DialogContent className="sm:max-w-xl border-border bg-popover text-popover-foreground shadow-2xl p-5 gap-5">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="size-4 text-cyan-500" />
              {isEditing ? "Edit Multi-Agent Team Chat" : "Create Multi-Agent Team Chat"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isEditing
                ? "Manage team roster, modify active teammates, and update session details."
                : "Assemble a multi-agent team that collaborates and hands off tasks automatically."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Section 1: Team Details */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2">
              <label
                htmlFor="group-name"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <Sparkles className="size-3.5 text-cyan-500" />
                Team Channel Name
              </label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Architecture Review Team"
                className="h-8 text-xs bg-background border-input"
                maxLength={64}
                autoFocus
                disabled={isSubmitting || isDeleting}
              />
            </div>

            {/* Section 2: Teammate Roster Selection */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-foreground">
                  Teammate Roster ({selectedBotIds.length} selected)
                </span>
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
                    className="text-[11px] font-mono text-cyan-500 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300 cursor-pointer transition-colors"
                  >
                    {selectedBotIds.length === bots.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background p-1.5 flex flex-col gap-1.5">
                {isLoadingBots ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                    <Spinner className="size-4" />
                    <span>Loading teammates...</span>
                  </div>
                ) : bots.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground text-center px-4">
                    No bots found. Create your first bot teammate first.
                  </div>
                ) : (
                  bots.map((bot) => {
                    const isChecked = selectedBotIds.includes(bot.id)
                    return (
                      <div
                        key={bot.id}
                        onClick={() => toggleBot(bot.id)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer select-none",
                          isChecked
                            ? "bg-cyan-500/10 border-cyan-500/30 text-foreground"
                            : "bg-card border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            isChecked
                              ? "bg-cyan-500 border-cyan-500 text-slate-950"
                              : "border-border bg-background"
                          )}
                        >
                          {isChecked && <Check className="size-3 stroke-[3]" />}
                        </div>

                        <ChatAvatar
                          seed={bot.avatar || bot.name}
                          className="size-7 rounded-md shrink-0 shadow-xs"
                        />

                        <div className="flex flex-1 items-center justify-between min-w-0">
                          <span className="text-xs font-semibold truncate text-foreground">
                            {bot.name}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground truncate ml-2">
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
            <DialogFooter className="mt-1 flex-col-reverse sm:flex-row sm:justify-between items-center gap-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isSubmitting || isDeleting}
                  onClick={() => setShowDeleteAlert(true)}
                  className="w-full sm:w-auto h-8 text-xs cursor-pointer bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                >
                  <Trash2Icon className="size-3.5" data-icon="inline-start" />
                  <span>Delete Team Chat</span>
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2 w-full justify-end sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting || isDeleting}
                  className="h-8 text-xs border-border hover:bg-muted cursor-pointer"
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
                  className="h-8 text-xs bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="size-3.5" />
                      <span>{isEditing ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    <span>{isEditing ? "Save Changes" : "Create Team Chat"}</span>
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
          <AlertDialogContent className="border-border bg-popover text-popover-foreground shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                Delete {chat?.name ? `"${chat.name}"` : "team chat"}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will permanently delete this team chat and its message
                history. The participating bots will remain untouched. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} className="border-border hover:bg-muted cursor-pointer">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={handleDelete}
                className="bg-rose-500 hover:bg-rose-600 text-white cursor-pointer"
              >
                {isDeleting && <Spinner data-icon="inline-start" />}
                Delete Team Chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

export default GroupChatDialog
