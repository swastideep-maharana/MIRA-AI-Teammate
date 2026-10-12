"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { nanoid } from "nanoid"
import { ShuffleIcon } from "lucide-react"

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
import { createBot } from "@/actions/bot"

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
  onSuccess: (bot: Bot) => void
}

function BotForm({ onSuccess }: BotFormProps) {
  const [initialSeed] = React.useState(() => nanoid())

  const form = useForm<BotInsert>({
    resolver: zodResolver(botInsertSchema),
    defaultValues: {
      name: "",
      job: "",
      instructions: "",
      avatar: initialSeed,
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

  const onSubmit = async (data: BotInsert) => {
    try {
      const newBot = await createBot(data)
      toast.add({
        title: "Bot created",
        description: `${newBot.name} is ready to chat.`,
        type: "success",
      })
      onSuccess(newBot)
    } catch (error) {
      toast.add({
        title: "Failed to create bot",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
        type: "error",
      })
    }
  }

  return (
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
      <DialogFooter className="mt-2">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Create bot
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface BotDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  onCreated?: (bot: Bot) => void
}

export function BotDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  onCreated,
}: BotDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const handleSuccess = (bot: Bot) => {
    setOpen(false)
    onCreated?.(bot)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        {open && <BotForm onSuccess={handleSuccess} />}
      </DialogContent>
    </Dialog>
  )
}
