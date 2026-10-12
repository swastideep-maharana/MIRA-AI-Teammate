"use client"

import { useMemo } from "react"
import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import definition from "@dicebear/styles/thumbs.json"
import { cn } from "@/lib/utils"

const style = new Style(definition)

export interface ChatAvatarProps {
  seed: string
  animated?: boolean
  className?: string
  alt?: string
}

export function ChatAvatar({
  seed,
  animated = false,
  className,
  alt,
}: ChatAvatarProps) {
  const src = useMemo(() => {
    const avatar = new Avatar(style, {
      seed,
      ...(animated ? { tags: ["animation"] } : {}),
    })
    return avatar.toDataUri()
  }, [seed, animated])

  return (
    <Image
      src={src}
      alt={alt ?? `${seed} avatar`}
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 rounded-full", className)}
    />
  )
}

export default ChatAvatar
