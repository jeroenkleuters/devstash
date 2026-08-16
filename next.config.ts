import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-tools badge (`data-next-badge`) — it sits bottom-left, on top
  // of the sidebar's user area. Development only; it never ships to production.
  devIndicators: false,
};

export default nextConfig;
