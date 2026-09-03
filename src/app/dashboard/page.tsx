import { Suspense } from "react";
import type { Metadata } from "next";

import { CollectionsSection } from "@/components/dashboard/collections-section";
import {
  CollectionsSectionSkeleton,
  PinnedItemsSectionSkeleton,
  RecentItemsSectionSkeleton,
  StatCardsSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { PinnedItemsSection } from "@/components/dashboard/pinned-items-section";
import { RecentItemsSection } from "@/components/dashboard/recent-items-section";
import { StatCards } from "@/components/dashboard/stat-cards";

export const metadata: Metadata = {
  title: "Dashboard · DevSquirrel",
};

// Collections are read per request — don't prerender them at build time.
export const dynamic = "force-dynamic";

// Each section owns its queries, so its own boundary lets the heading paint
// immediately and the sections stream in as their data resolves.
export default function DashboardPage() {
  return (
    <>
      <div className="dashboard-heading">
        <h1>Dashboard</h1>
        <p>Your developer knowledge hub</p>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <StatCards />
      </Suspense>

      <Suspense fallback={<CollectionsSectionSkeleton />}>
        <CollectionsSection />
      </Suspense>

      <Suspense fallback={<PinnedItemsSectionSkeleton />}>
        <PinnedItemsSection />
      </Suspense>

      <Suspense fallback={<RecentItemsSectionSkeleton />}>
        <RecentItemsSection />
      </Suspense>
    </>
  );
}
