"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Folder, Layers, Settings, Star } from "lucide-react";

import { useSidebar } from "@/components/layout/sidebar-provider";
import { Separator } from "@/components/ui/separator";
import { TYPE_ICONS } from "@/constants/item-types";
import { collections, currentUser, itemTypes } from "@/lib/mock-data";

/** How many non-favorite collections the "Recent" list shows. */
const RECENT_LIMIT = 5;

const favoriteCollections = collections.filter(
  (collection) => collection.isFavorite,
);

const recentCollections = collections
  .filter((collection) => !collection.isFavorite)
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, RECENT_LIMIT);

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar() {
  const pathname = usePathname();
  const { closeOnMobile } = useSidebar();
  const [typesOpen, setTypesOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);

  return (
    <aside className="dashboard-sidebar" aria-label="Sidebar">
      <Link
        href="/dashboard"
        className="sidebar-brand"
        title="DevStash"
        onClick={closeOnMobile}
      >
        <span className="sidebar-brand-mark">
          <Layers size={18} aria-hidden />
        </span>
        <span className="sidebar-brand-name">DevStash</span>
      </Link>

      <div className="sidebar-scroll">
        <nav className="sidebar-section" aria-label="Item types">
          <button
            type="button"
            className="sidebar-section-header"
            aria-expanded={typesOpen}
            onClick={() => setTypesOpen((open) => !open)}
          >
            Types
            <ChevronDown size={14} aria-hidden />
          </button>

          {typesOpen && (
            <ul className="sidebar-list">
              {itemTypes.map((type) => {
                const Icon = TYPE_ICONS[type.icon];
                const href = `/items/${type.slug}`;

                return (
                  <li key={type.id}>
                    <Link
                      href={href}
                      className="sidebar-link"
                      data-active={pathname === href}
                      title={type.name}
                      onClick={closeOnMobile}
                    >
                      {Icon && (
                        <Icon
                          className="sidebar-type-icon"
                          data-type={type.slug}
                          size={16}
                          aria-hidden
                        />
                      )}
                      <span className="sidebar-link-label">{type.name}</span>
                      <span className="sidebar-link-count">
                        {type.itemCount}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <Separator />

        <nav className="sidebar-section" aria-label="Collections">
          <button
            type="button"
            className="sidebar-section-header"
            aria-expanded={collectionsOpen}
            onClick={() => setCollectionsOpen((open) => !open)}
          >
            Collections
            <ChevronDown size={14} aria-hidden />
          </button>

          {collectionsOpen && (
            <>
              <p className="sidebar-subheading">Favorites</p>
              <ul className="sidebar-list">
                {favoriteCollections.map((collection) => {
                  const href = `/collections/${collection.id}`;

                  return (
                    <li key={collection.id}>
                      <Link
                        href={href}
                        className="sidebar-link"
                        data-active={pathname === href}
                        title={collection.name}
                        onClick={closeOnMobile}
                      >
                        <Folder className="sidebar-link-icon" size={16} aria-hidden />
                        <span className="sidebar-link-label">
                          {collection.name}
                        </span>
                        <Star
                          className="sidebar-link-star"
                          size={14}
                          fill="currentColor"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <p className="sidebar-subheading">Recent</p>
              <ul className="sidebar-list">
                {recentCollections.map((collection) => {
                  const href = `/collections/${collection.id}`;

                  return (
                    <li key={collection.id}>
                      <Link
                        href={href}
                        className="sidebar-link"
                        data-active={pathname === href}
                        title={collection.name}
                        onClick={closeOnMobile}
                      >
                        <Folder className="sidebar-link-icon" size={16} aria-hidden />
                        <span className="sidebar-link-label">
                          {collection.name}
                        </span>
                        <span className="sidebar-link-count">
                          {collection.itemCount}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>
      </div>

      <div className="sidebar-user">
        <span className="sidebar-user-avatar" aria-hidden>
          {initials(currentUser.name)}
        </span>
        <span className="sidebar-user-meta">
          <span className="sidebar-user-name">{currentUser.name}</span>
          <span className="sidebar-user-email">{currentUser.email}</span>
        </span>
        <button
          type="button"
          className="sidebar-user-settings"
          aria-label="Settings"
        >
          <Settings size={16} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
