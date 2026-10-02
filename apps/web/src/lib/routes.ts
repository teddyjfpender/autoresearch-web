import type { Route } from "next"

/** Every internal URL is built here, so route changes happen in one place. */
export const routes = {
  home: "/" as Route,
  homeSection: (id: string) => `/#${id}` as Route,
  challenge: (slug: string) => `/challenges/${slug}` as Route,
  challengeSection: (slug: string, id: string) => `/challenges/${slug}#${id}` as Route,
  submission: (slug: string, id: string) => `/challenges/${slug}/submissions/${id}` as Route,
}
