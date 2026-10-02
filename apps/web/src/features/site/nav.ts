import type { Route } from "next"

import { routes } from "@/lib/routes"

export interface NavItem {
  id: string
  label: string
  href: Route
}

export interface NavConfig {
  items: NavItem[]
  cta: { label: string; href: Route }
  /** Shown before the section links, e.g. a way back to the landing page. */
  back?: { label: string; href: Route }
}

const section = (id: string, label: string, href: Route): NavItem => ({ id, label, href })

export function landingNav(featuredSlug: string): NavConfig {
  return {
    items: [
      section("challenges", "Challenges", routes.homeSection("challenges")),
      section("how", "How it works", routes.homeSection("how")),
      section("participate", "Participate", routes.homeSection("participate")),
      section("faq", "FAQ", routes.homeSection("faq")),
    ],
    cta: { label: "Enter challenge", href: routes.challenge(featuredSlug) },
  }
}

export function challengeNav(slug: string): NavConfig {
  return {
    back: { label: "All challenges", href: routes.homeSection("challenges") },
    items: [
      section("leaderboard", "Leaderboard", routes.challengeSection(slug, "leaderboard")),
      section("discussion", "Discussion", routes.challengeSection(slug, "discussion")),
      section("details", "Details", routes.challengeSection(slug, "details")),
    ],
    cta: { label: "Start solving", href: routes.challengeSection(slug, "details") },
  }
}

/** Pick the nav for the current URL. */
export function navFor(pathname: string, featuredSlug: string): NavConfig {
  const match = /^\/challenges\/([a-z0-9-]+)/.exec(pathname)
  return match?.[1] === undefined ? landingNav(featuredSlug) : challengeNav(match[1])
}
