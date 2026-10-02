import { Avatar } from "@autoresearch/ui/components/avatar"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { ArrowUpRight } from "lucide-react"

import type { ResearchActivity, ResearchItem } from "@/lib/github-research"

function ResearchList({
  title,
  items,
  href,
}: {
  title: string
  items: readonly ResearchItem[] | null
  href: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
        <h3 className="text-2xl tracking-tight">{title}</h3>
        <a href={href} target="_blank" rel="noreferrer" className="text-label hover:text-fg">
          View on GitHub <ArrowUpRight className="ml-1 inline size-3" />
        </a>
      </div>
      {items === null ? (
        <p className="py-6 text-sm text-fg-muted">
          The live feed is unavailable. GitHub has the current activity.
        </p>
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-fg-muted">No activity yet. Start a thread on GitHub.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.number} className="py-5">
              <a href={item.url} target="_blank" rel="noreferrer" className="group block">
                <p className="text-label">
                  #{item.number} · {item.detail} · Updated {item.updatedAt.slice(0, 10)}
                </p>
                <h4 className="mt-1.5 text-lg group-hover:text-accent">{item.title}</h4>
                {item.excerpt !== "" ? (
                  <p className="mt-2 line-clamp-3 text-sm text-fg-muted">{item.excerpt}</p>
                ) : null}
                {item.author ? (
                  <span className="mt-3 inline-flex items-center gap-2 text-xs text-fg-faint">
                    <Avatar name={item.author.login} src={item.author.avatarUrl} size="xs" />
                    {item.author.login}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ResearchSection({
  activity,
  repositoryUrl,
  discussionsUrl,
}: {
  activity: ResearchActivity
  repositoryUrl: string
  discussionsUrl: string
}) {
  return (
    <Section id="research" className="border-t border-line">
      <Container>
        <Reveal>
          <Eyebrow index="03">Open research</Eyebrow>
          <Heading className="mt-6 max-w-[20ch]">
            Ideas and patches, <em className="font-display font-normal">in the open.</em>
          </Heading>
          <p className="mt-5 max-w-3xl text-fg-muted">
            Pull requests and Discussions come from the challenge repository. Performance claims
            here are the authors&apos; own; they become ranked results only after independent H200
            judging and a signed receipt.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <ResearchList
            title="Reviewable PRs"
            items={activity.pulls}
            href={`${repositoryUrl}/pulls`}
          />
          <ResearchList
            title="Research Discussions"
            items={activity.discussions}
            href={discussionsUrl}
          />
        </div>
      </Container>
    </Section>
  )
}
