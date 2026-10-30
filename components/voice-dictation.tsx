"use client"

import * as React from "react"
import { AudioLines, Mic, MicOff, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

export interface VoiceDictationProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
  lang?: string
}

export function VoiceDictation({
  onTranscript,
  disabled = false,
  className,
  lang = "en-US",
}: VoiceDictationProps) {
  const [isListening, setIsListening] = React.useState(false)
  const [isSupported, setIsSupported] = React.useState(true)
  const recognitionRef = React.useRef<any>(null)
  const isStoppingRef = React.useRef(false)

  // Initialize Web Speech API
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = lang

      recognition.onstart = () => {
        setIsListening(true)
        isStoppingRef.current = false
      }

      recognition.onresult = (event: any) => {
        let finalChunk = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript
          }
        }

        if (finalChunk.trim()) {
          onTranscript(finalChunk.trim())
        }
      }

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          // Normal silence, don't show error
          return
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setIsListening(false)
          toast.add({
            title: "Microphone access denied",
            description: "Please allow microphone permissions in your browser settings to use voice dictation.",
            type: "error",
          })
          return
        }

        if (event.error === "network") {
          setIsListening(false)
          toast.add({
            title: "Voice dictation network error",
            description: "Speech recognition service could not be reached. Check your network connection.",
            type: "error",
          })
          return
        }

        setIsListening(false)
      }

      recognition.onend = () => {
        if (!isStoppingRef.current && isListening) {
          // Restart if it unexpectedly disconnected while still meant to listen
          try {
            recognition.start()
            return
          } catch {
            // Fall through to stop
          }
        }
        setIsListening(false)
      }

      recognitionRef.current = recognition
    } catch {
      setIsSupported(false)
    }

    return () => {
      isStoppingRef.current = true
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [lang, onTranscript, isListening])

  // Stop listening if Escape is pressed
  React.useEffect(() => {
    if (!isListening) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        stopListening()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isListening])

  const startListening = () => {
    if (!recognitionRef.current || disabled) return
    isStoppingRef.current = false
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      // If already started, toggle off
      stopListening()
    }
  }

  const stopListening = () => {
    isStoppingRef.current = true
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
    }
    setIsListening(false)
  }

  const toggleListening = () => {
    if (!isSupported) {
      toast.add({
        title: "Voice dictation unsupported",
        description: "Your browser does not support Web Speech Recognition. Please try Google Chrome, Microsoft Edge, or Safari.",
        type: "error",
      })
      return
    }

    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice dictation is not supported in this browser"
        aria-label="Voice dictation unsupported"
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border/40 bg-muted/30 text-muted-foreground/50 cursor-not-allowed opacity-60 text-xs",
          className
        )}
      >
        <MicOff className="size-3.5" />
        <span className="text-xs font-medium hidden sm:inline">Voice</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      aria-pressed={isListening}
      title={
        isListening
          ? "Listening... Click to stop (or press Esc)"
          : "Voice dictation (speech-to-text)"
      }
      aria-label={isListening ? "Stop voice dictation" : "Start voice dictation"}
      className={cn(
        "relative inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all cursor-pointer shadow-2xs select-none active:scale-95 shrink-0",
        isListening
          ? "border border-rose-500/50 bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.25)]"
          : "border border-border/80 bg-secondary/80 hover:bg-secondary text-foreground hover:text-cyan-400 hover:border-cyan-500/50",
        className
      )}
    >
      {isListening ? (
        <>
          <AudioLines className="size-3.5 text-rose-500 animate-pulse shrink-0" strokeWidth={2} />
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            Listening...
          </span>
          <Square className="size-2.5 fill-current text-rose-500 shrink-0 ml-0.5" />
        </>
      ) : (
        <>
          <Mic className="size-3.5 text-muted-foreground group-hover:text-cyan-400 transition-colors shrink-0" strokeWidth={1.75} />
          <span className="text-xs font-medium">Dictate</span>
        </>
      )}
    </button>
  )
}

