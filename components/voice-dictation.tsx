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
  const isListeningRef = React.useRef(false)
  const isStoppingRef = React.useRef(false)
  const onTranscriptRef = React.useRef(onTranscript)

  // Keep onTranscript fresh without triggering re-initialization
  React.useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  // Initialize Web Speech API once per language
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
        isListeningRef.current = true
        isStoppingRef.current = false
      }

      recognition.onresult = (event: any) => {
        let finalChunk = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript + " "
          }
        }

        if (finalChunk.trim()) {
          onTranscriptRef.current(finalChunk.trim())
        }
      }

      recognition.onerror = (event: any) => {
        // Normal silence or browser abort, don't show noisy error
        if (event.error === "no-speech" || event.error === "aborted") {
          return
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setIsListening(false)
          isListeningRef.current = false
          toast.add({
            title: "Microphone access denied",
            description: "Please allow microphone permissions in your browser URL bar to use voice dictation.",
            type: "error",
          })
          return
        }

        if (event.error === "network") {
          setIsListening(false)
          isListeningRef.current = false
          toast.add({
            title: "Voice recognition network error",
            description: "Speech recognition service could not be reached. Check your internet connection.",
            type: "error",
          })
          return
        }

        setIsListening(false)
        isListeningRef.current = false
      }

      recognition.onend = () => {
        if (!isStoppingRef.current && isListeningRef.current) {
          // Restart if it paused naturally while the user was still speaking
          try {
            recognition.start()
            return
          } catch {
            // Ignore
          }
        }
        setIsListening(false)
        isListeningRef.current = false
      }

      recognitionRef.current = recognition
    } catch {
      setIsSupported(false)
    }

    return () => {
      isStoppingRef.current = true
      isListeningRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [lang])

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

  const startListening = async () => {
    if (disabled) return

    // Explicitly prompt for mic permission via getUserMedia if needed
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Immediately stop tracks so recognition can use the hardware audio interface
        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (permErr: any) {
      if (permErr?.name === "NotAllowedError" || permErr?.name === "PermissionDeniedError") {
        toast.add({
          title: "Microphone access blocked",
          description: "Microphone permissions were denied. Please allow microphone access in your browser settings.",
          type: "error",
        })
        return
      }
    }

    if (!recognitionRef.current) return
    isStoppingRef.current = false
    isListeningRef.current = true
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch (err: any) {
      if (err?.name === "InvalidStateError") {
        // Already active
        setIsListening(true)
      } else {
        setIsListening(false)
        isListeningRef.current = false
      }
    }
  }

  const stopListening = () => {
    isStoppingRef.current = true
    isListeningRef.current = false
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

