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
      section("proofs", "Proofs", routes.challengeSection(slug, "proofs")),
      section("discussion", "Discussion", routes.challengeSection(slug, "discussion")),
      section("details", "Details", routes.challengeSection(slug, "details")),
    ],
    cta: { label: "Start solving", href: routes.challengeSection(slug, "details") },
  }
}

/** A circuit challenge's board has its own tabs: architectures first, then the front. */
export function circuitNav(slug: string): NavConfig {
  return {
    back: { label: "All challenges", href: routes.homeSection("challenges") },
    items: [
      section("leaderboard", "Architectures", routes.challengeSection(slug, "leaderboard")),
      section("circuits", "Front", routes.challengeSection(slug, "circuits")),
      section("discussion", "Discussion", routes.challengeSection(slug, "discussion")),
      section("details", "Details", routes.challengeSection(slug, "details")),
    ],
    cta: { label: "Start solving", href: routes.challengeSection(slug, "details") },
  }
}

/** Pick the nav for the current URL. */
export function navFor(
  pathname: string,
  featuredSlug: string,
  circuitSlugs: readonly string[] = [],
): NavConfig {
  const slug = /^\/challenges\/([a-z0-9-]+)/.exec(pathname)?.[1]
  if (slug === undefined) return landingNav(featuredSlug)
  return circuitSlugs.includes(slug) ? circuitNav(slug) : challengeNav(slug)
}
