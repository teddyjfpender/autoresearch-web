import { Button } from "@autoresearch/ui/components/button"
import { Container } from "@autoresearch/ui/components/layout"
import Link from "next/link"

export default function NotFound() {
  return (
    <Container className="flex min-h-[80svh] flex-col items-start justify-center gap-8 pt-24">
      <p className="text-label">404 · proof rejected</p>
      <h1 className="text-6xl font-normal tracking-[-0.05em] sm:text-8xl">
        Nothing <em className="font-display font-normal">verifies</em> here.
      </h1>
      <Button asChild>
        <Link href="/">Back to the board</Link>
      </Button>
    </Container>
  )
}
