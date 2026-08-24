import { FolderPlus, Search } from "lucide-react";

import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Dashboard top bar. The search field and New Collection are still display
 * only; New Item opens the create dialog.
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
        <Button variant="outline" size="lg" aria-label="New Collection">
          <FolderPlus aria-hidden />
          <span className="action-label">New Collection</span>
        </Button>
        <ItemCreateDialog />
      </div>
    </header>
  );
}
