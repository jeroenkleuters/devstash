"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ItemDrawer } from "@/components/items/item-drawer";
import type { ItemSummary } from "@/lib/db/items";
import type { ItemDetail } from "@/types/item";

/** What the drawer's body is showing while and after the fetch. */
export type ItemDetailState =
  | { status: "loading" }
  | { status: "ready"; detail: ItemDetail }
  | { status: "error"; message: string };

interface ItemDrawerContextValue {
  /** Opens the drawer on an item and starts fetching its detail. */
  openItem: (item: ItemSummary) => void;
}

const ItemDrawerContext = createContext<ItemDrawerContextValue | null>(null);

export function useItemDrawer() {
  const context = useContext(ItemDrawerContext);
  if (!context) {
    throw new Error("useItemDrawer must be used within ItemDrawerProvider");
  }
  return context;
}

const ERRORS: Record<number, string> = {
  401: "Your session has expired. Sign in again to see this item.",
  404: "That item no longer exists.",
};

const GENERIC_ERROR = "Could not load this item. Try again.";

/**
 * Holds the open drawer's item, since the pages that render the cards are
 * server components and cannot hold state of their own.
 *
 * One drawer for the whole shell rather than one per card: the card only needs
 * to say which item was clicked, and mounting a `Sheet` per row would put a
 * hundred portals on the dashboard to show at most one.
 */
export function ItemDrawerProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ItemSummary | null>(null);
  const [state, setState] = useState<ItemDetailState>({ status: "loading" });
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Identifies the fetch the drawer is currently showing. Clicking a second
  // card, or closing, bumps it — so a slower earlier response cannot land on
  // top of a later one.
  const requestRef = useRef(0);

  const openItem = useCallback((item: ItemSummary) => {
    const requestId = ++requestRef.current;

    // The card already carries the title, type, tags and flags, so the header
    // paints on click and only the body waits on the network.
    setSummary(item);
    setState({ status: "loading" });
    setOpen(true);

    void (async () => {
      try {
        const response = await fetch(`/api/items/${item.id}`);

        if (!response.ok) {
          if (requestRef.current === requestId) {
            setState({
              status: "error",
              message: ERRORS[response.status] ?? GENERIC_ERROR,
            });
          }
          return;
        }

        const detail = (await response.json()) as ItemDetail;

        if (requestRef.current === requestId) {
          setState({ status: "ready", detail });
        }
      } catch {
        if (requestRef.current === requestId) {
          setState({ status: "error", message: GENERIC_ERROR });
        }
      }
    })();
  }, []);

  /**
   * Takes the item a save just returned. It bumps `requestRef` for the same
   * reason a second click does: a GET issued before the save must not land on
   * top of a newer, stored value.
   *
   * `summary` is updated alongside, since the header and the card behind the
   * drawer paint from it — leaving it would show the old title next to the new
   * content until the router refresh caught up.
   */
  const handleSaved = useCallback((detail: ItemDetail) => {
    requestRef.current += 1;
    setState({ status: "ready", detail });

    setSummary((current) =>
      current && current.id === detail.id
        ? {
            ...current,
            title: detail.title,
            description: detail.description,
            tags: detail.tags,
            updatedAt: new Date(detail.updatedAt),
          }
        : current,
    );

    // The lists are server-rendered, so the cards behind the drawer only pick
    // the change up on a refetch.
    router.refresh();
  }, [router]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);

    // Drop whatever is in flight, but keep `summary` — the sheet animates out
    // and clearing it now would blank the drawer on the way.
    if (!next) {
      requestRef.current += 1;
    }
  }, []);

  const value = useMemo(() => ({ openItem }), [openItem]);

  return (
    <ItemDrawerContext.Provider value={value}>
      {children}
      {summary && (
        <ItemDrawer
          summary={summary}
          state={state}
          open={open}
          onOpenChange={handleOpenChange}
          onSaved={handleSaved}
        />
      )}
    </ItemDrawerContext.Provider>
  );
}
