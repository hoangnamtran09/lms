"use client"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  delay = 0,
  ...props
}: React.ComponentProps<"div"> & { delay?: number }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-muted",
        "opacity-0 animate-[skeleton-pulse_2s_ease-in-out_infinite,skeleton-fade-in_0.4s_ease-out_forwards]",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
      {...props}
    />
  )
}

export { Skeleton }
