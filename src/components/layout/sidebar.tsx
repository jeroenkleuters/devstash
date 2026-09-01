"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Folder, Layers, Star } from "lucide-react";

import { useBilling } from "@/components/billing/billing-provider";
import { LinkPendingIcon, LinkSpinner } from "@/components/layout/link-pending";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { SidebarUser } from "@/components/layout/sidebar-user";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PRO_TYPE_SLUGS, TYPE_ICONS } from "@/constants/item-types";
import type { CollectionSummary } from "@/lib/db/collections";
import type { ItemTypeWithCount } from "@/lib/db/items";
import type { CurrentUser } from "@/lib/db/user";

interface SidebarProps {
  types: ItemTypeWithCount[];
  favoriteCollections: CollectionSummary[];
  recentCollections: CollectionSummary[];
  user: CurrentUser | null;
}

export function Sidebar({
  types,
  favoriteCollections,
  recentCollections,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const { closeOnMobile } = useSidebar();
  const { isPro, requestUpgrade } = useBilling();
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
              {types.map((type) => {
                const Icon = TYPE_ICONS[type.icon];
                const href = `/items/${type.slug}`;
                const proType = PRO_TYPE_SLUGS.has(type.slug);

                // A free account is sent to the upsell rather than to an empty
                // Pro listing — but only when the listing really is empty. An
                // account that was Pro and lapsed still owns its files, and
                // hiding the one page they are on would be taking them away
                // rather than gating what it can add.
                const locked = proType && !isPro && type.itemCount === 0;

                const icon = Icon ? (
                  <Icon
                    className="sidebar-type-icon"
                    data-type={type.slug}
                    size={16}
                    aria-hidden
                  />
                ) : null;

                // The label and everything after it is the same in both
                // branches; only the leading icon differs, since the locked
                // button never navigates and has nothing to be pending about.
                const contents = (
                  <>
                    <span className="sidebar-link-label">{type.name}</span>
                    {proType && (
                      <Badge variant="outline" className="sidebar-pro-badge">
                        PRO
                      </Badge>
                    )}
                    <span className="sidebar-link-count">{type.itemCount}</span>
                  </>
                );

                return (
                  <li key={type.id}>
                    {locked ? (
                      <button
                        type="button"
                        className="sidebar-link"
                        data-locked
                        title={`${type.name} — requires Pro`}
                        onClick={() =>
                          requestUpgrade({
                            kind: "type",
                            label: `${type.name}s`,
                          })
                        }
                      >
                        {icon}
                        {contents}
                      </button>
                    ) : (
                      <Link
                        href={href}
                        className="sidebar-link"
                        data-active={pathname === href}
                        title={type.name}
                        onClick={closeOnMobile}
                      >
                        <LinkPendingIcon>{icon}</LinkPendingIcon>
                        {contents}
                      </Link>
                    )}
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
              {favoriteCollections.length > 0 && (
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
                            <LinkPendingIcon>
                              <Folder
                                className="sidebar-link-icon"
                                size={16}
                                aria-hidden
                              />
                            </LinkPendingIcon>
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
                </>
              )}

              {recentCollections.length > 0 && (
                <>
                  <p className="sidebar-subheading">Recent</p>
                  <ul className="sidebar-list">
                    {recentCollections.map((collection) => {
                      const href = `/collections/${collection.id}`;
                      // Color-coded by the type the collection holds most of.
                      const [primaryType] = collection.types;

                      return (
                        <li key={collection.id}>
                          <Link
                            href={href}
                            className="sidebar-link"
                            data-active={pathname === href}
                            title={collection.name}
                            onClick={closeOnMobile}
                          >
                            <LinkPendingIcon>
                              <span
                                className="sidebar-link-dot"
                                data-type={primaryType?.slug}
                                aria-hidden
                              />
                            </LinkPendingIcon>
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

              <Link
                href="/collections"
                className="sidebar-view-all"
                onClick={closeOnMobile}
              >
                View all collections
                <LinkSpinner size={14} />
              </Link>
            </>
          )}
        </nav>
      </div>

      <SidebarUser user={user} />
    </aside>
  );
}
