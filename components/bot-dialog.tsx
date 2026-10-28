"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { nanoid } from "nanoid"
import { ShuffleIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ChatAvatar } from "@/components/chat-avatar"
import { botInsertSchema, type BotInsert, type Bot } from "@/db/schema"
import { createBot, updateBot, deleteBot } from "@/actions/bot"

const PRESETS = [
  {
    label: "Research assistant",
    name: "Ada",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    label: "Code reviewer",
    name: "Linus",
    job: "Code reviewer",
    instructions:
      "Review code changes for correctness, security, performance, and readability. Be concise and actionable.",
  },
  {
    label: "Writing editor",
    name: "Hemingway",
    job: "Writing editor",
    instructions:
      "Proofread and polish writing for tone, clarity, and conciseness while preserving author's intent.",
  },
  {
    label: "Tutor",
    name: "Socrates",
    job: "Tutor",
    instructions:
      "Explain concepts clearly using examples and analogies. Encourage problem-solving step by step.",
  },
] as const

interface BotFormProps {
  bot?: Bot | null
  onSuccess: (bot: Bot & { chatId?: string }) => void
  onDeleted?: (bot: Bot) => void
}

function BotForm({ bot, onSuccess, onDeleted }: BotFormProps) {
  const router = useRouter()
  const isEditing = Boolean(bot)
  const [initialSeed] = React.useState(() => bot?.avatar || nanoid())
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const form = useForm<BotInsert>({
    resolver: zodResolver(botInsertSchema),
    defaultValues: {
      name: bot?.name ?? "",
      job: bot?.job ?? "",
      instructions: bot?.instructions ?? "",
      avatar: bot?.avatar ?? initialSeed,
    },
  })

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = form

  const currentAvatar = watch("avatar")

  const handlePresetSelect = (preset: (typeof PRESETS)[number]) => {
    setValue("name", preset.name, { shouldValidate: true })
    setValue("job", preset.job, { shouldValidate: true })
    setValue("instructions", preset.instructions, { shouldValidate: true })
  }

  const handleShuffleAvatar = () => {
    setValue("avatar", nanoid(), { shouldValidate: true })
  }

  const handleDelete = async () => {
    if (!bot) return
    setIsDeleting(true)
    try {
      await deleteBot(bot.id)
      toast.add({
        title: "Bot deleted",
        description: `${bot.name} was deleted.`,
        type: "success",
      })
      setShowDeleteAlert(false)
      onDeleted?.(bot)
    } catch (error) {
      toast.add({
        title: "Failed to delete bot",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const onSubmit = async (data: BotInsert) => {
    try {
      if (isEditing && bot) {
        const updatedBot = await updateBot(bot.id, data)
        toast.add({
          title: "Bot updated",
          description: `${updatedBot.name} was updated.`,
          type: "success",
        })
        onSuccess(updatedBot)
      } else {
        const res = await fetch("/api/bots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const result = await res.json()
        if (!res.ok || result.error) {
          throw new Error(result.error || "Failed to create bot")
        }
        const newBot = result.bot
        toast.add({
          title: "Bot created",
          description: `${newBot.name} is ready to chat.`,
          type: "success",
        })
        onSuccess(newBot)
        if (newBot.chatId) {
          router.push(`/chats/${newBot.chatId}`)
          router.refresh()
        }
      }
    } catch (error) {
      toast.add({
        title: isEditing ? "Failed to update bot" : "Failed to create bot",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
        type: "error",
      })
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-3 py-1 text-xs font-normal hover:bg-accent"
              onClick={() => handlePresetSelect(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Face section */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ChatAvatar
              seed={currentAvatar}
              animated
              className="size-11"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Face</span>
              <span className="text-xs text-muted-foreground">
                Shuffle until you find one you like.
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShuffleAvatar}
            className="gap-1.5"
          >
            <ShuffleIcon className="size-3.5" data-icon="inline-start" />
            Shuffle
          </Button>
        </div>

        {/* Fields */}
        <FieldGroup className="gap-4">
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="bot-name"
                  placeholder="Ada"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="job"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                <Input
                  {...field}
                  id="bot-job"
                  placeholder="Research assistant"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="instructions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bot-instructions">
                  How it should work
                </FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id="bot-instructions"
                  placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                  aria-invalid={fieldState.invalid}
                  className="min-h-24 resize-none"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>

        {/* Footer */}
        <DialogFooter className="mt-2 flex-col-reverse sm:flex-row sm:justify-between items-center gap-2">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteAlert(true)}
              disabled={isSubmitting || isDeleting}
            >
              {isDeleting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2 w-full justify-end sm:w-auto">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || isDeleting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isEditing ? "Save changes" : "Create bot"}
            </Button>
          </div>
        </DialogFooter>
      </form>

      {isEditing && (
        <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {bot?.name || "bot"}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this bot and its conversations. This action cannot be undone.
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
                Delete bot
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

export interface BotDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  onCreated?: (bot: Bot & { chatId?: string }) => void
  onUpdated?: (bot: Bot) => void
  onDeleted?: (bot: Bot) => void
  bot?: Bot | null
}

export function BotDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  onCreated,
  onUpdated,
  onDeleted,
  bot,
}: BotDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const isEditing = Boolean(bot)

  const handleSuccess = (savedBot: Bot & { chatId?: string }) => {
    setOpen(false)
    if (isEditing) {
      onUpdated?.(savedBot)
    } else {
      onCreated?.(savedBot)
    }
  }

  const handleDeleteSuccess = (deletedBot: Bot) => {
    setOpen(false)
    onDeleted?.(deletedBot)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update its face, name, and instructions."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BotForm
            bot={bot}
            onSuccess={handleSuccess}
            onDeleted={handleDeleteSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default BotDialog
