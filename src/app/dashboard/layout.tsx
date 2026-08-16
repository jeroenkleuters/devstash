import { Suspense } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { SidebarSkeleton } from "@/components/layout/sidebar-skeleton";
import { TopBar } from "@/components/layout/top-bar";
import {
  getSidebarCollections,
  type SidebarCollections,
} from "@/lib/db/collections";
import { getItemTypesWithCounts } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

/** How many non-favorite collections the sidebar's "Recent" list shows. */
const RECENT_LIMIT = 5;

const NO_COLLECTIONS: SidebarCollections = { favorites: [], recent: [] };

// The sidebar reads its types and collections per request.
export const dynamic = "force-dynamic";

// The shell itself needs no data, so it renders while the sidebar's queries and
// the page below it resolve in parallel.
export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarWithData />
      </Suspense>
      <div className="dashboard-body">
        <TopBar />
        <main className="dashboard-main">{children}</main>
      </div>
    </SidebarProvider>
  );
}

async function SidebarWithData() {
  const user = await getCurrentUser();
  const [types, collections] = user
    ? await Promise.all([
        getItemTypesWithCounts(user.id),
        getSidebarCollections(user.id, RECENT_LIMIT),
      ])
    : [[], NO_COLLECTIONS];

  return (
    <Sidebar
      types={types}
      favoriteCollections={collections.favorites}
      recentCollections={collections.recent}
      user={user}
    />
  );
}
