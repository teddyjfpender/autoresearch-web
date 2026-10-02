import { Container } from "@autoresearch/ui/components/layout"
import { ArrowUpRight } from "lucide-react"

import type { Challenge, Site } from "@/data/schema"
import { routes } from "@/lib/routes"

import { landingNav } from "./nav"
import { SectionLink } from "./section-link"

const YEAR = new Date().getUTCFullYear()

export function SiteFooter({ site, challenges }: { site: Site; challenges: readonly Challenge[] }) {
  const [word, tld] = site.name.split(".")
  const featured = challenges.find((challenge) => challenge.slug === site.featuredChallenge)
  const linkClass = "text-fg-muted transition-colors hover:text-fg"
  return (
    <footer className="relative overflow-hidden border-t border-line pt-20">
      <Container className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="text-2xl leading-tight tracking-tight">
            Open research, <em className="font-display text-3xl">verified</em> on the rig.
          </p>
          <p className="mt-4 text-sm text-fg-muted">{site.summary}</p>
        </div>
        <nav aria-label="Footer: explore">
          <p className="text-label">Explore</p>
          <ul className="mt-4 space-y-2 text-sm">
            {landingNav(site.featuredChallenge).items.map((item) => (
              <li key={item.id}>
                <SectionLink href={item.href} className={linkClass}>
                  {item.label}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Footer: challenges">
          <p className="text-label">Challenges</p>
          <ul className="mt-4 space-y-2 text-sm">
            {challenges.map((challenge) => (
              <li key={challenge.slug}>
                <SectionLink href={routes.challenge(challenge.slug)} className={linkClass}>
                  {challenge.name}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>
        {featured ? (
          <div>
            <p className="text-label">Elsewhere</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                { label: "Challenge repository", href: featured.links.repo },
                { label: "stwo-zig prover", href: featured.links.prover },
                { label: "Research discussions", href: featured.links.discussions },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`group inline-flex items-center gap-1 ${linkClass}`}
                  >
                    {link.label}
                    <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>

      <Container className="mt-16 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-fg-faint">
        <span>
          © {YEAR} {site.site}
        </span>
        <span>Data imported from the challenge repository · no ranked submissions yet</span>
      </Container>

      <p
        aria-hidden
        className="pointer-events-none mt-6 -mb-[0.2em] text-center text-[12.4vw] leading-none font-normal tracking-[-0.07em] whitespace-nowrap text-fg/[0.04] select-none"
      >
        {word}
        <span className="font-display italic">.{tld}</span>
      </p>
    </footer>
  )
}
