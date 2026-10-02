import { cn } from "@autoresearch/ui/lib/cn"

/** 3×3 "warp" glyph: one lit lane, the rest idle. Rotates on hover of its parent link. */
export function Logo({ className }: { className?: string }) {
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 grid-cols-3 gap-[2px] transition-transform duration-700 ease-out-expo [a:hover_&]:rotate-90",
        className,
      )}
    >
      {cells.map((cell) => (
        <span
          key={cell}
          className={cn(
            "rounded-[1.5px] transition-colors duration-500",
            cell % 3 === 1 ? "bg-accent" : "bg-fg/30 [a:hover_&]:bg-fg/60",
          )}
        />
      ))}
    </span>
  )
}
