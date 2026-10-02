import { TooltipProvider } from "@autoresearch/ui/components/tooltip"
import { themeInitScript } from "@autoresearch/ui/hooks/use-theme"
import { cn } from "@autoresearch/ui/lib/cn"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import type { ReactNode } from "react"

import { SiteFooter } from "@/features/site/site-footer"
import { SiteHeader } from "@/features/site/site-header"
import { SmoothScroll } from "@/features/site/smooth-scroll"
import { getChallenges, getSite } from "@/data/source"

import "./globals.css"

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
})

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite()
  const siteUrl = process.env["SITE_URL"] ?? "https://autoresearch-web-lac.vercel.app"
  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
    description: site.summary,
    openGraph: { title: site.tagline, description: site.summary, type: "website" },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#f4f1e8" },
  ],
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [site, challenges] = await Promise.all([getSite(), getChallenges()])
  const featured = challenges.find((challenge) => challenge.slug === site.featuredChallenge)
  if (!featured) throw new Error("Featured challenge is missing")
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={cn(sans.variable, mono.variable, display.variable)}
    >
      <head>
        {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- static, first-party theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="grain min-h-dvh overflow-x-clip">
        <TooltipProvider>
          <SmoothScroll />
          <a
            href="#main"
            className="fixed top-3 left-3 z-[60] -translate-y-20 rounded-full bg-accent px-4 py-2 text-sm text-accent-fg focus:translate-y-0"
          >
            Skip to content
          </a>
          <SiteHeader
            name={site.name}
            featuredSlug={site.featuredChallenge}
            repositoryUrl={featured.links.repo}
          />
          <main id="main">{children}</main>
          <SiteFooter site={site} challenges={challenges} />
        </TooltipProvider>
      </body>
    </html>
  )
}
