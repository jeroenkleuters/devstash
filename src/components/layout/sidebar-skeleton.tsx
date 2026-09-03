import Image from "next/image";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/img/logo.png";

/** How many rows each list stands in for: the seven system types, five collections. */
const TYPE_ROW_COUNT = 7;
const COLLECTION_ROW_COUNT = 5;

function placeholders(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

/**
 * Suspense fallback for the sidebar. The brand is static so it paints straight
 * away; the rows carry the real link classes so the collapsed icon rail hides
 * their labels the same way it does for the loaded sidebar.
 */
export function SidebarSkeleton() {
  return (
    <aside className="dashboard-sidebar" aria-label="Sidebar" aria-busy="true">
      <div className="sidebar-brand">
        <Image
          className="sidebar-brand-mark"
          src={logo}
          alt=""
          width={32}
          height={32}
        />
        <span className="sidebar-brand-name">DevSquirrel</span>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <p className="sidebar-section-header">Types</p>
          <SidebarRows count={TYPE_ROW_COUNT} />
        </div>

        <Separator />

        <div className="sidebar-section">
          <p className="sidebar-section-header">Collections</p>
          <SidebarRows count={COLLECTION_ROW_COUNT} />
        </div>
      </div>

      <div className="sidebar-user">
        <Skeleton className="user-avatar" />
        <span className="sidebar-user-meta">
          <span className="sidebar-user-name">
            <Skeleton className="skeleton-line skeleton-sidebar-user-name" />
          </span>
          <span className="sidebar-user-email">
            <Skeleton className="skeleton-line skeleton-sidebar-user-email" />
          </span>
        </span>
      </div>
    </aside>
  );
}

function SidebarRows({ count }: { count: number }) {
  return (
    <ul className="sidebar-list">
      {placeholders(count).map((index) => (
        <li key={index}>
          <span className="sidebar-link">
            <Skeleton className="skeleton-sidebar-icon" />
            <Skeleton className="sidebar-link-label skeleton-line skeleton-sidebar-label" />
          </span>
        </li>
      ))}
    </ul>
  );
}
