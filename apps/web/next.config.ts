import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@flowsuite/engine', '@flowsuite/ui', '@flowsuite/data'],
};

export default nextConfig;
