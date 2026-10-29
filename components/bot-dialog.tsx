"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { nanoid } from "nanoid"
import {
  ShuffleIcon,
  Trash2Icon,
  Cpu,
  Monitor,
  Terminal,
  Brain,
  Sparkles,
  ShieldCheck,
} from "lucide-react"

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
import { cn } from "@/lib/utils"

const PRESETS = [
  {
    label: "Research Assistant",
    name: "Ada",
    job: "Research Assistant",
    instructions:
      "Answer briefly, cite reliable sources, and confirm before running anything destructive.",
  },
  {
    label: "Code Reviewer",
    name: "Linus",
    job: "Code Reviewer",
    instructions:
      "Review code changes for correctness, security, performance, and readability. Be concise and actionable.",
  },
  {
    label: "DevOps Engineer",
    name: "Turing",
    job: "DevOps Engineer",
    instructions:
      "Automate deployments, debug container runtime logs, inspect bash environments, and monitor health.",
  },
  {
    label: "Product Editor",
    name: "Hemingway",
    job: "Writing Editor",
    instructions:
      "Proofread and polish writing for tone, clarity, and conciseness while preserving author intent.",
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
  const [isShuffling, setIsShuffling] = React.useState(false)

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
  const currentInstructions = watch("instructions") || ""

  const handlePresetSelect = (preset: (typeof PRESETS)[number]) => {
    setValue("name", preset.name, { shouldValidate: true })
    setValue("job", preset.job, { shouldValidate: true })
    setValue("instructions", preset.instructions, { shouldValidate: true })
  }

  const handleShuffleAvatar = () => {
    setIsShuffling(true)
    setValue("avatar", nanoid(), { shouldValidate: true })
    setTimeout(() => setIsShuffling(false), 350)
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
          description: `${newBot.name} is ready with Daytona sandbox.`,
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 pt-2">
        {/* Preset Starter Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Quick Persona Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 rounded-full px-2.5 py-0.5 text-xs font-normal border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:border-cyan-500/30 transition-all cursor-pointer"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Section 1: Identity & Persona */}
        <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-cyan-500" />
              Identity & Persona
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleShuffleAvatar}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer font-mono"
              aria-label="Shuffle avatar face"
            >
              <ShuffleIcon
                className={cn(
                  "size-3 text-cyan-500 transition-transform duration-300",
                  isShuffling && "rotate-180 scale-125"
                )}
              />
              Shuffle Face
            </Button>
          </div>

          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                "relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-background border border-border shadow-md transition-transform duration-300",
                isShuffling && "scale-110"
              )}
            >
              <ChatAvatar seed={currentAvatar} animated className="size-12" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-0">
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="space-y-1">
                    <FieldLabel htmlFor="bot-name" className="text-xs text-muted-foreground">
                      Bot Name
                    </FieldLabel>
                    <Input
                      {...field}
                      id="bot-name"
                      placeholder="e.g. Ada"
                      aria-invalid={fieldState.invalid}
                      className="h-8 text-xs bg-background border-input"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="job"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="space-y-1">
                    <FieldLabel htmlFor="bot-job" className="text-xs text-muted-foreground">
                      Job / Role Title
                    </FieldLabel>
                    <Input
                      {...field}
                      id="bot-job"
                      placeholder="e.g. Staff Research Lead"
                      aria-invalid={fieldState.invalid}
                      className="h-8 text-xs bg-background border-input"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Capabilities & Runtime */}
        <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Cpu className="size-3.5 text-cyan-500" />
            Active Capabilities & Daytona Runtime
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border text-muted-foreground">
              <Terminal className="size-3.5 text-cyan-500 shrink-0" />
              <span className="truncate">Bash & Filesystem</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border text-muted-foreground">
              <Monitor className="size-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">noVNC Desktop</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border text-muted-foreground">
              <ShieldCheck className="size-3.5 text-cyan-500 shrink-0" />
              <span className="truncate">Cloud Sandbox</span>
            </div>
          </div>
        </div>

        {/* Section 3: System Prompt & Operating Guidelines */}
        <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Brain className="size-3.5 text-cyan-500" />
              System Prompt & Instructions
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {currentInstructions.length} chars
            </span>
          </div>

          <Controller
            control={control}
            name="instructions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-1">
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id="bot-instructions"
                  placeholder="Define role behavioral guidelines, tool usage preferences, memory constraints, and output styles..."
                  aria-invalid={fieldState.invalid}
                  className="min-h-24 resize-none font-mono text-xs bg-background border-input leading-relaxed text-foreground"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        {/* Footer Actions */}
        <DialogFooter className="mt-1 flex-col-reverse sm:flex-row sm:justify-between items-center gap-2">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteAlert(true)}
              disabled={isSubmitting || isDeleting}
              className="w-full sm:w-auto h-8 text-xs cursor-pointer bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
            >
              {isDeleting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon className="size-3.5" data-icon="inline-start" />
              )}
              Delete Bot
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2 w-full justify-end sm:w-auto">
            <DialogClose render={<Button type="button" variant="outline" className="h-8 text-xs border-border hover:bg-muted cursor-pointer" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting || isDeleting}
              className="h-8 text-xs bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold cursor-pointer shadow-xs"
            >
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isEditing ? "Save Changes" : "Create Teammate"}
            </Button>
          </div>
        </DialogFooter>
      </form>

      {isEditing && (
        <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
          <AlertDialogContent className="border-border bg-popover text-popover-foreground shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete {bot?.name || "bot"}?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will permanently delete this bot, its provisioned cloud sandbox, and conversation history. This action cannot be undone.
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
                Delete Bot
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
      <DialogContent className="sm:max-w-xl border-border bg-popover text-popover-foreground shadow-2xl p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {isEditing ? "Edit AI Teammate" : "Create New AI Teammate"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Refine identity persona, Daytona runtime environment, and operational prompt."
              : "Spin up a dedicated AI teammate with unique personality and cloud sandbox."}
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
