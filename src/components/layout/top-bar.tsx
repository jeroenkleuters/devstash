import Link from "next/link";
import { Star } from "lucide-react";

import { CollectionCreateDialog } from "@/components/collections/collection-create-dialog";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { SearchTrigger } from "@/components/search/search-trigger";
import { Button } from "@/components/ui/button";

/**
 * Dashboard top bar. The search field opens the command palette; the star goes
 * to the favorites list, and New Collection and New Item each open their own
 * create dialog.
 */
export function TopBar() {
  return (
    <header className="dashboard-topbar">
      <SidebarToggle />

      <SearchTrigger />

      <div className="dashboard-topbar-actions">
        {/* Icon only, so it needs the label a visible one would have carried. */}
        <Button variant="ghost" size="icon" asChild>
          <Link href="/favorites" aria-label="Favorites" title="Favorites">
            <Star size={16} aria-hidden />
          </Link>
        </Button>

        <CollectionCreateDialog />
        <ItemCreateDialog />
      </div>
    </header>
  );
}
