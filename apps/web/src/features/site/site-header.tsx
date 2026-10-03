"use client"

import { Button } from "@autoresearch/ui/components/button"
import { ThemeToggle } from "@autoresearch/ui/components/theme-toggle"
import { cn } from "@autoresearch/ui/lib/cn"
import { ArrowLeft, ArrowUpRight, Menu, X } from "lucide-react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { routes } from "@/lib/routes"

import { AgentPromptDialog, type PromptChallenge } from "../participate/agent-prompt-dialog"

import { Logo } from "./logo"
import { navFor, type NavItem } from "./nav"
import { SectionLink } from "./section-link"

/**
 * The section currently under the middle of the viewport. State is keyed by pathname, so a
 * route change resets it without a synchronous setState in the effect.
 */
function useActiveSection(items: readonly NavItem[], pathname: string): string | null {
  const [state, setState] = useState<{ pathname: string; id: string } | null>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const { id } = entry.target
          setState((previous) =>
            previous?.pathname === pathname && previous.id === id ? previous : { pathname, id },
          )
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    )
    for (const item of items) {
      const node = document.getElementById(item.id)
      if (node) observer.observe(node)
    }
    return () => {
      observer.disconnect()
    }
  }, [items, pathname])
  return state?.pathname === pathname ? state.id : null
}

export function SiteHeader({
  name,
  featuredSlug,
  challenges,
}: {
  name: string
  featuredSlug: string
  /** Participation targets by slug; the prompt only appears on a challenge's own pages. */
  challenges: readonly (PromptChallenge & { slug: string })[]
}) {
  const pathname = usePathname()
  const current = challenges.find((challenge) => {
    const base = routes.challenge(challenge.slug)
    return pathname === base || pathname.startsWith(`${base}/`)
  })
  const nav = useMemo(() => navFor(pathname, featuredSlug), [pathname, featuredSlug])
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  // The menu is "open for a pathname", so navigating closes it automatically.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const active = useActiveSection(nav.items, pathname)

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24)
  })

  const close = () => {
    setOpenOn(null)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-[86rem] items-center justify-between gap-4 rounded-full border pr-2 pl-5 transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled || open
            ? "border-line bg-bg/80 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={routes.home}
            className="flex items-center gap-2.5"
            aria-label={`${name} home`}
          >
            <Logo />
            <span className="hidden font-mono text-sm tracking-tight sm:inline">{name}</span>
          </Link>
          {nav.back ? (
            <SectionLink
              href={nav.back.href}
              aria-label={nav.back.label}
              title={nav.back.label}
              className="group hidden size-8 items-center justify-center gap-1.5 rounded-full border border-line text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg xl:inline-flex 2xl:size-auto 2xl:px-3 2xl:py-1.5"
            >
              <ArrowLeft className="size-3 transition-transform duration-300 group-hover:-translate-x-0.5" />
              {/* Icon-only beside the full nav at xl; the label returns when there's room. */}
              <span className="hidden 2xl:inline">{nav.back.label}</span>
            </SectionLink>
          ) : null}
        </div>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {nav.items.map((item) => (
              <li key={item.id}>
                <SectionLink
                  href={item.href}
                  aria-current={active === item.id ? "location" : undefined}
                  className={cn(
                    "relative inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors duration-300",
                    active === item.id ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {active === item.id ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-surface"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {current ? <AgentPromptDialog challenge={current} /> : null}
          <Button asChild size="sm" className="hidden h-10 px-4 sm:inline-flex">
            <SectionLink href={nav.cta.href}>
              {nav.cta.label}
              <ArrowUpRight className="transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
            </SectionLink>
          </Button>
          <button
            type="button"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-fg xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => {
              setOpenOn(open ? null : pathname)
            }}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            className="mx-auto mt-2 max-w-[86rem] overflow-hidden rounded-3xl border border-line bg-bg/90 backdrop-blur-xl xl:hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul className="flex flex-col p-3">
              {[...nav.items, ...(nav.back ? [{ id: "back", ...nav.back }] : [])].map(
                (item, index) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index + 0.1 }}
                  >
                    <SectionLink
                      href={item.href}
                      onClick={close}
                      className={cn(
                        "flex items-baseline justify-between rounded-2xl px-4 py-3 text-2xl tracking-tight hover:bg-surface",
                        active === item.id && "text-fg",
                      )}
                    >
                      {item.label}
                      <span className="font-mono text-xs text-fg-faint">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </SectionLink>
                  </motion.li>
                ),
              )}
              <li className="mt-2 px-1">
                <Button asChild className="w-full">
                  <SectionLink href={nav.cta.href} onClick={close}>
                    {nav.cta.label}
                    <ArrowUpRight />
                  </SectionLink>
                </Button>
              </li>
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
