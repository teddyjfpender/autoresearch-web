import "server-only"

import { z } from "zod"

const actor = z.object({ login: z.string(), avatar_url: z.url() })
const pull = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  html_url: z.url(),
  state: z.enum(["open", "closed"]),
  draft: z.boolean(),
  updated_at: z.iso.datetime(),
  user: actor.nullable(),
  head: z.object({ sha: z.string() }),
})
const discussion = z.object({
  number: z.number().int(),
  title: z.string(),
  bodyText: z.string(),
  url: z.url(),
  updatedAt: z.iso.datetime(),
  author: z.object({ login: z.string(), avatarUrl: z.url() }).nullable(),
  category: z.object({ name: z.string() }),
  comments: z.object({ totalCount: z.number().int() }),
})

export interface ResearchItem {
  number: number
  title: string
  excerpt: string
  url: string
  updatedAt: string
  author: { login: string; avatarUrl: string } | null
  detail: string
}

export interface ResearchActivity {
  pulls: ResearchItem[] | null
  discussions: ResearchItem[] | null
}

const DISCUSSIONS_QUERY = `query ChallengeDiscussions($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    discussions(first: 12, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number title bodyText url updatedAt author { login avatarUrl }
        category { name } comments { totalCount } }
    }
  }
}`

function excerpt(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280)
}

/** Public GitHub research is displayed as unverified claims, never as ranked results. */
export async function getResearchActivity(repositoryUrl: string): Promise<ResearchActivity> {
  const url = new URL(repositoryUrl)
  if (url.hostname !== "github.com") throw new Error("Research repository must be on GitHub")
  const [owner, name] = url.pathname.split("/").filter(Boolean)
  if (owner === undefined || name === undefined)
    throw new Error("Research repository needs owner and name")

  const token = process.env["GITHUB_READ_TOKEN"]
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token !== undefined && token !== "") headers["Authorization"] = `Bearer ${token}`
  const pullsPromise = fetch(
    `https://api.github.com/repos/${owner}/${name}/pulls?state=all&per_page=20&sort=updated&direction=desc`,
    { headers, next: { revalidate: 300 } },
  )
    .then(async (response) => (response.ok ? pull.array().parse(await response.json()) : null))
    .then(
      (items) =>
        items?.map((item) => ({
          number: item.number,
          title: item.title,
          excerpt: excerpt(item.body ?? ""),
          url: item.html_url,
          updatedAt: item.updated_at,
          author: item.user ? { login: item.user.login, avatarUrl: item.user.avatar_url } : null,
          detail: item.draft ? "Draft PR" : item.state === "open" ? "Open PR" : "Closed PR",
        })) ?? null,
    )
    .catch(() => null)

  // GitHub's Discussions API is GraphQL and requires a server-side read token.
  const discussionsPromise: Promise<ResearchItem[] | null> =
    token !== undefined && token !== ""
      ? fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ query: DISCUSSIONS_QUERY, variables: { owner, name } }),
          next: { revalidate: 300 },
        })
          .then(async (response) => {
            if (!response.ok) return null
            const json: unknown = await response.json()
            const result = z
              .object({
                data: z.object({
                  repository: z.object({
                    discussions: z.object({ nodes: discussion.array() }),
                  }),
                }),
              })
              .safeParse(json)
            return result.success
              ? result.data.data.repository.discussions.nodes.map((item) => ({
                  number: item.number,
                  title: item.title,
                  excerpt: excerpt(item.bodyText),
                  url: item.url,
                  updatedAt: item.updatedAt,
                  author: item.author,
                  detail: `${item.category.name} · ${String(item.comments.totalCount)} comments`,
                }))
              : null
          })
          .catch(() => null)
      : Promise.resolve(null)

  const [pulls, discussions] = await Promise.all([pullsPromise, discussionsPromise])
  return { pulls, discussions }
}
