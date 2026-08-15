import type { Metadata } from "next";

import { CollectionsSection } from "@/components/dashboard/collections-section";
import { PinnedItemsSection } from "@/components/dashboard/pinned-items-section";
import { RecentItemsSection } from "@/components/dashboard/recent-items-section";
import { StatCards } from "@/components/dashboard/stat-cards";

export const metadata: Metadata = {
  title: "Dashboard · DevStash",
};

// Collections are read per request — don't prerender them at build time.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <div className="dashboard-heading">
        <h1>Dashboard</h1>
        <p>Your developer knowledge hub</p>
      </div>

      <StatCards />
      <CollectionsSection />
      <PinnedItemsSection />
      <RecentItemsSection />
    </>
  );
}
