"use client"

import * as React from "react"
import { ChatAvatar } from "@/components/chat-avatar"
import { cn } from "@/lib/utils"

export interface GroupChatAvatarProps {
  bots?: Array<{ avatar?: string | null; name?: string | null; id?: string }> | null
  className?: string
  alt?: string
}

export function GroupChatAvatar({
  bots = [],
  className,
  alt = "Group chat avatar",
}: GroupChatAvatarProps) {
  const memberBots = (bots ?? []).filter(Boolean)
  const count = memberBots.length

  // Case 0 or 1: single avatar filling the square
  if (count <= 1) {
    const single = memberBots[0]
    return (
      <ChatAvatar
        seed={single?.avatar || single?.name || "group"}
        className={cn("size-8 rounded-lg", className)}
        alt={alt}
      />
    )
  }

  // Case 2: Two items sit side by side, overlapping
  if (count === 2) {
    return (
      <div
        className={cn(
          "relative size-8 shrink-0 rounded-lg overflow-hidden bg-muted/30 select-none",
          className
        )}
        aria-label={alt}
      >
        <div className="absolute left-[3%] top-1/2 -translate-y-1/2 size-[65%] rounded-full overflow-hidden border border-background shadow-xs z-10 flex items-center justify-center">
          <ChatAvatar
            seed={memberBots[0].avatar || memberBots[0].name || "1"}
            className="size-full object-cover"
          />
        </div>
        <div className="absolute right-[3%] top-1/2 -translate-y-1/2 size-[65%] rounded-full overflow-hidden border border-background shadow-xs z-20 flex items-center justify-center">
          <ChatAvatar
            seed={memberBots[1].avatar || memberBots[1].name || "2"}
            className="size-full object-cover"
          />
        </div>
      </div>
    )
  }

  // Case 3: Three form a triangle
  if (count === 3) {
    return (
      <div
        className={cn(
          "relative size-8 shrink-0 rounded-lg overflow-hidden bg-muted/30 select-none",
          className
        )}
        aria-label={alt}
      >
        {/* Top apex */}
        <div className="absolute top-[2%] left-1/2 -translate-x-1/2 size-[55%] rounded-full overflow-hidden border border-background shadow-xs z-20 flex items-center justify-center">
          <ChatAvatar
            seed={memberBots[0].avatar || memberBots[0].name || "1"}
            className="size-full object-cover"
          />
        </div>
        {/* Bottom left */}
        <div className="absolute bottom-[2%] left-[4%] size-[55%] rounded-full overflow-hidden border border-background shadow-xs z-10 flex items-center justify-center">
          <ChatAvatar
            seed={memberBots[1].avatar || memberBots[1].name || "2"}
            className="size-full object-cover"
          />
        </div>
        {/* Bottom right */}
        <div className="absolute bottom-[2%] right-[4%] size-[55%] rounded-full overflow-hidden border border-background shadow-xs z-10 flex items-center justify-center">
          <ChatAvatar
            seed={memberBots[2].avatar || memberBots[2].name || "3"}
            className="size-full object-cover"
          />
        </div>
      </div>
    )
  }

  // Case 4+: Four fill a 2x2 grid (up to 3 visible bot avatars, and the rest is shown with a number)
  const visibleBots = memberBots.slice(0, 3)
  const remainingCount = count - 3

  return (
    <div
      className={cn(
        "relative size-8 shrink-0 rounded-lg overflow-hidden bg-muted/40 p-0.5 grid grid-cols-2 grid-rows-2 gap-0.5 select-none",
        className
      )}
      aria-label={alt}
    >
      {/* Top Left */}
      <div className="size-full rounded-[3px] overflow-hidden border border-background/60 flex items-center justify-center bg-background/50">
        <ChatAvatar
          seed={visibleBots[0].avatar || visibleBots[0].name || "1"}
          className="size-full object-cover"
        />
      </div>

      {/* Top Right */}
      <div className="size-full rounded-[3px] overflow-hidden border border-background/60 flex items-center justify-center bg-background/50">
        <ChatAvatar
          seed={visibleBots[1].avatar || visibleBots[1].name || "2"}
          className="size-full object-cover"
        />
      </div>

      {/* Bottom Left */}
      <div className="size-full rounded-[3px] overflow-hidden border border-background/60 flex items-center justify-center bg-background/50">
        <ChatAvatar
          seed={visibleBots[2].avatar || visibleBots[2].name || "3"}
          className="size-full object-cover"
        />
      </div>

      {/* Bottom Right: Number tile showing remaining count */}
      <div className="size-full rounded-[3px] overflow-hidden border border-background/60 flex items-center justify-center bg-muted text-muted-foreground font-bold text-[9px] leading-none">
        +{remainingCount}
      </div>
    </div>
  )
}

export default GroupChatAvatar
