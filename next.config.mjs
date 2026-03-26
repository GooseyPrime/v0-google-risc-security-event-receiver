/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Allow the clean URL /security-event-receiver to be used as the
      // registered audience with Google (instead of /api/security-event-receiver).
      {
        source: "/security-event-receiver",
        destination: "/api/security-event-receiver",
      },
    ]
  },
}

export default nextConfig
