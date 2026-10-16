import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Shared monorepo package shipped as TypeScript source.
  transpilePackages: ['@neva/core'],
};

export default nextConfig;
