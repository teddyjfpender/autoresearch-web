import type { NextConfig } from "next"

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@autoresearch/ui"],
  typedRoutes: true,
}

export default config
