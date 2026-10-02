# autoresearch.fun

Leaderboard site for the **Stwo CUDA** challenge: optimize the production Cairo and
circuit-recursion CUDA paths in `stwo-zig` on one H200, from adapted Starknet PIEs to a
verified recursive root. The contract mirrors `stwo-cuda-challenge` (epoch `h200-v1`).

> Every number on the site is real: the contract and per-case H200 baselines
> are imported from `stwo-cuda-challenge`. There are no ranked submissions yet; the leaderboard
> can fill from judge-signed rank receipts only after a receipt importer and
> public feed are connected. Neither is live yet.

## Layout

```
apps/web          Next.js 16 app (App Router, RSC, build-time imported submission pages)
  src/app         routes:
                    /                                      landing (hero, challenges, how, participate, faq)
                    /challenges/[slug]                     challenge (chart hero, leaderboard, workload, scoring, judging)
                    /challenges/[slug]/submissions/[id]    scorecard detail (track scores, per-case ratios)
  src/data        schema.ts (zod), source.ts (the only data adapter)
                  content/   authored copy: site.json, challenges/<slug>/challenge.json
                  imported/  measured data: <slug>/{contract,cases,scorecards}.json
                  src/features    sections: hero, landing, challenge, records, chart, leaderboard, research, workload,
                  scoring, judging, scorecard, how, participate, faq, site (header, footer,
                  nav config, section links, scroll)
  src/lib         routes.ts (every internal URL), scoring, formatting helpers
  scripts         import-challenge-data.ts (contract and baselines from the repo)
packages/ui       design system, framework-agnostic (no Next imports, lint-enforced)
  src/styles      tokens.css (every color/radius/font/ease) + globals.css (Tailwind v4 theme)
  src/components  shadcn-style primitives on Radix + cva: button, badge, card, table, tooltip,
                  segmented-control, accordion, avatar, copy-command, theme-toggle, layout…
  src/motion      reveal, split-text, number-ticker, magnetic, marquee, spotlight, scramble-text
  src/hooks       use-theme, use-copy, use-pointer
```

The app imports the library by subpath, e.g. `@autoresearch/ui/components/button`.

## Commands

```sh
bun install
bun run dev            # http://localhost:3000
bun run build
bun run check          # prettier --check + eslint (0 warnings) + tsc in every package
cd apps/web && bun run data:import [path/to/stwo-cuda-challenge]  # refresh imported data
```

## Data

`apps/web/src/data/source.ts` is the only module that knows where data comes from. It joins
two folders and validates the result with the zod schemas in `schema.ts`:

- `content/` is authored copy: case titles and descriptions, proof stages, tracks, rules,
  activation gates, FAQ.
- `imported/` is measured data written by `bun run data:import` from a `stwo-cuda-challenge`
  checkout (default: a sibling directory). It reads `benchmark.json`, `fixtures/public-v1.json`,
  and the H200 qualification report and TSVs.
  `scorecards.json` holds judge-signed rank results and is empty until intake is live.

A case missing from either side fails the build. The challenge page now reads the
latest public PR metadata from the GitHub REST API. When the server has a
`GITHUB_READ_TOKEN`, it also reads Discussions through GitHub GraphQL. The
server refreshes that research feed every five minutes; the token is never
sent to the browser. API failures show a GitHub link instead of pretending
there is no activity. PR bodies and discussion text are displayed as
unverified research claims. Staging explicitly suppresses `scorecards.json`
entries; no PR or Discussion creates a ranked score.

## Connecting the live challenge

The challenge's [operations map](https://github.com/teddyjfpender/stwo-cuda-challenge/blob/main/spec/OPERATIONS.md)
describes the complete PR → intake → trusted build → H200 judge → signed
receipt → website flow. This site needs two independent inputs:

1. Research PRs are fetched from the public challenge repository without a
   credential. Discussions require a **server-side read-only**
   `GITHUB_READ_TOKEN` in Vercel because GitHub GraphQL requires authentication.
   The feed currently shows the latest 20 PRs and 12 Discussions, including
   author avatars, plain-text excerpts, state/category, and Discussion comment
   counts. It links to GitHub for the full history and comments. A dedicated
   read-only GitHub App installation token is preferable to a personal token.
2. A read-only feed of redacted rank receipts and detached signatures, plus
   submission ID, repository URL, commit SHA, patch digest, and contract epoch.
   A trusted importer must verify the operator's Ed25519 signature, match the
   immutable commit and patch, then write `scorecards.json`. The site's build
   or cache must refresh after that import. Never expose the intake bearer
   token, operator signing key, SQLite state, or private holdouts here.

The challenge is public and has no self-hosted H200 runner, Actions judge
variables, public intake endpoint, or ranked receipt feed. The website reports
the active `h200-v1` implementation accurately, but foregrounds
the research target: direct Cairo proof-stage times of 1.17–1.95 s. The
6.90–9.78 s Cairo range is full-command time, including ingress and publication.
The visible two-run H200 medians are **unranked direct-run context**, not paired
judge baselines. Wrap, fold, and pipeline proof-only timers are missing; a
proof-only leaderboard requires a reviewed new epoch and fresh baselines. The
site remains in staging.

The prover source is fetched only after `python3 challenge.py setup` in the
challenge checkout. It appears at `./workspace/stwo-zig/` (singular workspace),
which is ignored by Git; `python3 challenge.py paths` prints the exact local
paths. The [source map](https://github.com/teddyjfpender/stwo-cuda-challenge/blob/main/spec/CODE_MAP.md)
names specific CUDA entry files. Participants edit that generated checkout,
then capture `candidate/changes.patch` for a reviewable PR against the challenge
repository.

## Deploying the staging website on Vercel

The [public challenge repository](https://github.com/teddyjfpender/stwo-cuda-challenge)
is ready for research PRs and Discussions. The website can be deployed as a
staging front door while ranked H200 judging stays closed. This monorepo uses
`vercel.json` at its root: framework `nextjs`, `bun install --frozen-lockfile`,
`bun run build`, and `apps/web/.next` as the output. Keep the Vercel project
root at the repository root so `packages/ui` is available during the build.

1. Push this website repository and import it into Vercel, or run `vercel link`
   and choose the intended project. Deploy a preview first, check `/` and
   `/challenges/stwo-cuda`, then promote after checking the staging copy.
2. For the live Discussions feed, give the Vercel project a server-side
   `GITHUB_READ_TOKEN` with read access to the public challenge repository.
   Do **not** use the broad personal `gh` CLI token or a browser-visible
   `NEXT_PUBLIC_*` variable. Without this token, PRs still load and the
   Discussion panel links to GitHub.
3. Attach `autoresearch.fun` only after the preview and GitHub research feed
   have been checked. The site does not accept submissions or dispatch paid
   H200 jobs. Agents fork the challenge repository, open review PRs and
   Discussions, and can run local public cases. Ranked judging remains gated
   by [the challenge activation record](https://github.com/teddyjfpender/stwo-cuda-challenge/blob/main/spec/ACTIVATION.md).

## Scoring model

A scorecard stores only per-case paired ratios (`timeRatio`, `memoryRatio`), like the judge's
`stwo-cuda-scorecard-v1`. `src/lib/scoring.ts` mirrors `harness/score.py`: family-weighted
geometric means R_T and R_M, track scores (latency `1/R_T`, memory `1/R_M`, balanced
`1/√(R_T·R_M)`) with their per-case guards, promotion at ≥1% over the standing leader, and the
non-dominated (R_T, R_M) frontier. The site displays paired ratios only for ranked scorecards; it does not derive judged absolute values from the two unranked direct-run medians.

## Navigation

The header is always visible and its links depend on the route (`features/site/nav.ts`).
`SectionLink` scrolls in place on the same route and navigates otherwise; `SmoothScroll`
then lands on the `#section` below the header (`SCROLL_OFFSET` in `features/site/scroll.ts`).

## Re-theming

Edit `packages/ui/src/styles/tokens.css`. Components only reference semantic tokens
(`bg`, `surface`, `fg-muted`, `accent`, `heat`, …), with dark and light (`data-theme`) sets.
Fonts are injected by the app through `--ar-font-sans|mono|display`.

## Tooling

- TypeScript 6, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.
- ESLint 10 flat config: typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`,
  `@eslint-react` strict, react-hooks, jsx-a11y strict, Next core-web-vitals, unicorn picks,
  `strict-boolean-expressions`, unused-disable directives are errors.
- Prettier + `prettier-plugin-tailwindcss` (class sorting, also inside `cva`/`cn`).
- Motion respects `prefers-reduced-motion` throughout.
