import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@pp-planning/api-client',
    '@pp-planning/contracts',
    '@pp-planning/design-tokens',
    '@pp-planning/ui-web',
  ],
  eslint: {
    // Lint is executed via `pnpm lint` / CI; avoid Next loading a conflicting ESLint graph.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
