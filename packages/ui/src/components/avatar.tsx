import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export type AvatarProps = ComponentProps<"span"> & {
  name: string
  src?: string | undefined
  size?: "xs" | "sm" | "md"
}

const sizes = {
  xs: "size-5 text-[0.5625rem]",
  sm: "size-7 text-[0.6875rem]",
  md: "size-9 text-xs",
} as const

/**
 * Image avatar with a neutral monogram fallback (no network needed for mock data).
 */
export function Avatar({ name, src, size = "sm", className, style, ...props }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-strong font-mono text-fg-muted uppercase ring-2 ring-bg",
        sizes[size],
        className,
      )}
      style={style}
      {...props}
    >
      {src === undefined ? (
        <span aria-hidden>{name.slice(0, 2)}</span>
      ) : (
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  )
}

export interface AvatarStackProps {
  names: readonly string[]
  max?: number
  size?: AvatarProps["size"]
  className?: string
}

export function AvatarStack({ names, max = 3, size = "xs", className }: AvatarStackProps) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <span className={cn("inline-flex items-center -space-x-1.5", className)}>
      {shown.map((name) => (
        <Avatar key={name} name={name} size={size} />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            "relative inline-flex items-center justify-center rounded-full bg-surface-strong font-mono text-fg-muted ring-2 ring-bg",
            sizes[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  )
}
