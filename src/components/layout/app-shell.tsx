import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { ItemDrawerProvider } from "@/components/items/item-drawer-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { SidebarSkeleton } from "@/components/layout/sidebar-skeleton";
import { TopBar } from "@/components/layout/top-bar";
import { getSidebarCollections } from "@/lib/db/collections";
import { getItemTypesWithCounts } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

/** How many non-favorite collections the sidebar's "Recent" list shows. */
const RECENT_LIMIT = 5;

/**
 * The signed-in shell: sidebar, top bar and a scrollable main column. Shared by
 * every authenticated route's layout, which is why it lives here rather than in
 * one of them — `/dashboard` and `/profile` render the same frame.
 *
 * Needs no data of its own, so it renders while the sidebar's queries and the
 * page inside it resolve in parallel.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarWithData />
      </Suspense>
      <div className="dashboard-body">
        <TopBar />
        {/* Wraps the page rather than living in one, because item cards appear
            on the dashboard and on `/items/[type]` and both are server
            components. `/profile` renders no cards and simply never opens it. */}
        <ItemDrawerProvider>
          <main className="dashboard-main">{children}</main>
        </ItemDrawerProvider>
      </div>
    </SidebarProvider>
  );
}

async function SidebarWithData() {
  const user = await getCurrentUser();

  // The proxy only checks that the JWT verifies, which is not the same as the
  // session still being good: the account may be gone, or the password it was
  // opened with may have been changed. Either way there is nothing to render.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const [types, collections] = await Promise.all([
    getItemTypesWithCounts(user.id),
    getSidebarCollections(user.id, RECENT_LIMIT),
  ]);

  return (
    <Sidebar
      types={types}
      favoriteCollections={collections.favorites}
      recentCollections={collections.recent}
      user={user}
    />
  );
}
