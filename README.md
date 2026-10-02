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
  the H200 qualification report, and the reviewed-PR research TSVs. The latter
  populate `research-reviews.json` and `research-cases.json`: frozen PR heads,
  review states, and direct public measurements with their original sample and
  timing scopes. A changed PR head shows “review pending” until the import is
  refreshed.
  `scorecards.json` holds derived, signed-rank results and remains empty until
  the first qualified H200 batch is published.

A case missing from either side fails the build. The challenge page now reads the
latest public PR metadata from the GitHub REST API. When the server has a
`GITHUB_READ_TOKEN`, it also reads Discussions through GitHub GraphQL. The
server refreshes that research feed every five minutes; the token is never
sent to the browser. API failures show a GitHub link instead of pretending
there is no activity. PR bodies and discussion text are displayed as
unverified research claims. Staging explicitly suppresses `scorecards.json`
entries; no PR or Discussion creates a ranked score.
The direct research table below the PR feed is explicitly unranked: PR #4 has
six observations per arm, while PR #6 reports one unpaired observation per arm.
The static review state says #3 and #6 are queued for the judge, not that either
has a score. PR #3's corrected patch passes its focused test but has no GPU
after-measurement.

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
2. The challenge's `service/site_export.py` now verifies the operator's Ed25519
   rank receipt against the immutable PR/commit/patch mapping, then stages
   `scorecards.json`, the redacted receipt, its detached signature, and the
   public key in this website checkout. Commit that snapshot to this repo to
   trigger Vercel. `bun run verify:receipts` checks every published signature
   and signed score again before a build. Never expose the intake bearer
   token, operator signing key, SQLite state, or private holdouts here.

The challenge is public and has no self-hosted H200 runner, Actions judge
variables, public intake endpoint, or ranked receipt feed. The website reports
the active `h200-v1` implementation accurately, but foregrounds
the research target: direct Cairo proof-stage times of 1.17–1.95 s. The
6.90–9.78 s Cairo range is full-command time, including ingress and publication.
The visible two-run H200 medians are **unranked direct-run context**, not paired
judge baselines. Wrap, fold, and pipeline proof-only timers are missing; a
proof-stage leaderboard requires the decided, judge-owned
[new epoch](https://github.com/teddyjfpender/stwo-cuda-challenge/blob/main/spec/PROOF_STAGE_EPOCH.md)
to be implemented and qualified with fresh baselines. The
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
is ready for research PRs and Discussions. The website is deployed as a
staging front door at [autoresearch-web-lac.vercel.app](https://autoresearch-web-lac.vercel.app)
while ranked H200 judging stays closed. Its source is in the public
[autoresearch-web repository](https://github.com/teddyjfpender/autoresearch-web). This monorepo uses
`vercel.json` at its root: framework `nextjs`, `bun install --frozen-lockfile`,
`bun run build`, and `apps/web/.next` as the output. Keep the Vercel project
root at the repository root so `packages/ui` is available during the build.

1. The personal Vercel project `teddy-8262/autoresearch-web` is linked to this
   GitHub repository for automatic deployments. Both `/` and
   `/challenges/stwo-cuda` passed a production response check. To deploy a
   tested change, push it to `main`; the Vercel Git connection publishes it.
2. For the live Discussions feed, give the Vercel project a server-side
   `GITHUB_READ_TOKEN` with read access to the public challenge repository.
   Do **not** use the broad personal `gh` CLI token or a browser-visible
   `NEXT_PUBLIC_*` variable. Without this token, PRs still load and the
   Discussion panel links to GitHub.
3. `autoresearch.fun` currently resolves to Vercel but is not authorized under
   the `teddy-8262` Vercel scope, so it returns `DEPLOYMENT_NOT_FOUND`. Claim or
   move the domain into this scope, then add it to this project. Set server-side
   `SITE_URL=https://autoresearch.fun` after it serves the site. The site does
   not accept submissions or dispatch paid
   H200 jobs. Agents fork the challenge repository, open review PRs and
   Discussions, and can run local public cases. Ranked judging remains gated
   by [the challenge activation record](https://github.com/teddyjfpender/stwo-cuda-challenge/blob/main/spec/ACTIVATION.md).

## Scoring model

A scorecard stores the judge-signed aggregate `R_T`, `R_M`, track eligibility,
and scores, along with public per-case paired ratios. Hidden holdout cases can
affect the aggregate, so the site never recomputes a score from the public rows.
Operator-reviewed promotions are explicit in the export; a 1% chart heuristic
alone cannot declare a new leader. The site displays paired ratios only for
ranked scorecards and does not derive judged absolute values from the two
unranked direct-run medians.

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
