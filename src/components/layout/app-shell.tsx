import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { EditorPreferencesProvider } from "@/components/editor/editor-preferences-provider";
import { ItemDrawerProvider } from "@/components/items/item-drawer-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { SidebarSkeleton } from "@/components/layout/sidebar-skeleton";
import { TopBar } from "@/components/layout/top-bar";
import { SearchProvider } from "@/components/search/search-provider";
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
 * It awaits the account for one reason: the editors read their settings from a
 * context, and reading them in the browser instead would open every editor on
 * the defaults and then jump. That costs some of the parallel paint the sidebar
 * boundary below exists to protect, but no query — `getCurrentUser` is
 * memoized per request, so `SidebarWithData` shares this one.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarWithData />
      </Suspense>
      {/* These providers wrap the page rather than living in one, because the
          item cards and the top bar are server components and cannot hold state
          of their own. The drawer wraps the top bar too, not just `main`: the
          command palette lives up there and opens items with it. */}
      <EditorPreferencesProvider initialPreferences={user.editorPreferences}>
        <ItemDrawerProvider>
          <SearchProvider>
            <div className="dashboard-body">
              <TopBar />
              <main className="dashboard-main">{children}</main>
            </div>
          </SearchProvider>
        </ItemDrawerProvider>
      </EditorPreferencesProvider>
    </SidebarProvider>
  );
}

async function SidebarWithData() {
  const user = await getCurrentUser();

  // Belt and braces since `AppShell` now turns the same case away above: the
  // proxy only checks that the JWT verifies, which is not the same as the
  // session still being good — the account may be gone, or the password it was
  // opened with may have been changed.
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
