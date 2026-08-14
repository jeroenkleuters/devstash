"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Matches the breakpoint the dashboard CSS switches to a drawer at. */
const DESKTOP_QUERY = "(min-width: 48rem)";

/**
 * `null` means "untouched" — the sidebar then follows the viewport default
 * (open on desktop, closed on mobile) purely through CSS, which keeps the
 * server and client markup identical.
 */
type SidebarState = boolean | null;

interface SidebarContextValue {
  toggle: () => void;
  /** Closes the drawer on mobile only — a no-op on desktop. */
  closeOnMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}

function isDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** Renders the dashboard grid so the shell can react to the sidebar state. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<SidebarState>(null);

  const toggle = useCallback(() => {
    setOpen((previous) => !(previous ?? isDesktop()));
  }, []);

  const closeOnMobile = useCallback(() => {
    if (!isDesktop()) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open !== true) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDesktop()) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const value = useMemo(() => ({ toggle, closeOnMobile }), [toggle, closeOnMobile]);

  return (
    <SidebarContext.Provider value={value}>
      <div
        className="dashboard-shell"
        data-sidebar-open={open === null ? "auto" : String(open)}
      >
        {children}
        <button
          type="button"
          className="dashboard-backdrop"
          aria-label="Close sidebar"
          onClick={closeOnMobile}
        />
      </div>
    </SidebarContext.Provider>
  );
}
