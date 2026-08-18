import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-tools badge (`data-next-badge`) — it sits bottom-left, on top
  // of the sidebar's user area. Development only; it never ships to production.
  devIndicators: false,
  images: {
    // Avatars linked to a GitHub account. `next/image` refuses remote hosts it
    // was not told about, so the sign-in provider dictates this list.
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
