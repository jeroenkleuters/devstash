import { CollectionCreateDialog } from "@/components/collections/collection-create-dialog";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { SearchTrigger } from "@/components/search/search-trigger";

/**
 * Dashboard top bar. The search field opens the command palette; New Collection
 * and New Item each open their own create dialog.
 */
export function TopBar() {
  return (
    <header className="dashboard-topbar">
      <SidebarToggle />

      <SearchTrigger />

      <div className="dashboard-topbar-actions">
        <CollectionCreateDialog />
        <ItemCreateDialog />
      </div>
    </header>
  );
}
