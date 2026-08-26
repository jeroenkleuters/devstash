import { Search } from "lucide-react";

import { CollectionCreateDialog } from "@/components/collections/collection-create-dialog";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { Input } from "@/components/ui/input";

/**
 * Dashboard top bar. The search field is still display only; New Collection and
 * New Item each open their own create dialog.
 */
export function TopBar() {
  return (
    <header className="dashboard-topbar">
      <SidebarToggle />

      <div className="dashboard-search">
        <Search className="dashboard-search-icon" size={16} aria-hidden />
        <Input
          type="search"
          placeholder="Search items..."
          aria-label="Search items"
        />
        <kbd className="dashboard-search-shortcut">⌘ K</kbd>
      </div>

      <div className="dashboard-topbar-actions">
        <CollectionCreateDialog />
        <ItemCreateDialog />
      </div>
    </header>
  );
}
