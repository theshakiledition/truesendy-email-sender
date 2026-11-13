/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    // Prevent TypeScript build errors from aborting Docker container builds
    ignoreBuildErrors: true,
  },
  eslint: {
    // Prevent ESLint warnings/errors from failing production builds
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
