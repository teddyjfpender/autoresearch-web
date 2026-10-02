"use client"

import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentProps, MouseEvent } from "react"

import { scrollToHash } from "./scroll"

export type SectionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: Route }

/**
 * Link to `/path#section`. On the same route it smooth-scrolls in place (header-aware) and
 * updates the URL; on another route it navigates and `SmoothScroll` lands on the section.
 */
export function SectionLink({ href, onClick, ...props }: SectionLinkProps) {
  const pathname = usePathname()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return
    const [path = "", hash = ""] = href.split("#")
    if ((path === "" ? pathname : path) !== pathname) return
    if (scrollToHash(hash)) {
      event.preventDefault()
      window.history.pushState(null, "", hash === "" ? pathname : `#${hash}`)
    }
  }

  return <Link href={href} scroll={false} onClick={handleClick} {...props} />
}
