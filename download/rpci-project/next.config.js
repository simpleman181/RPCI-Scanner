/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do NOT use output: "standalone" — that's for Docker, not Vercel
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

module.exports = nextConfig;
