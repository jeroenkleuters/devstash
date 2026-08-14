import { FolderPlus, Plus, Search } from "lucide-react";

import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Dashboard top bar. Display only for now — the search field and the
 * action buttons are not wired up yet.
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
          <span className="dashboard-topbar-action-label">New Collection</span>
        </Button>
        <Button size="lg" aria-label="New Item">
          <Plus aria-hidden />
          <span className="dashboard-topbar-action-label">New Item</span>
        </Button>
      </div>
    </header>
  );
}
