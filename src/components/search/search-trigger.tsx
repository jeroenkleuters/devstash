"use client";

import { Search } from "lucide-react";

import { useSearch } from "@/components/search/search-provider";

/**
 * The top bar's search field. A button rather than an input: typing happens in
 * the palette, and a real input here would have to hand its first keystroke
 * over to another one.
 */
export function SearchTrigger() {
  const { openSearch } = useSearch();

  return (
    <button type="button" className="dashboard-search" onClick={openSearch}>
      <Search className="dashboard-search-icon" size={16} aria-hidden />
      <span className="dashboard-search-placeholder">Search items...</span>
      <kbd className="dashboard-search-shortcut">⌘ K</kbd>
    </button>
  );
}
