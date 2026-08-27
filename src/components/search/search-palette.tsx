"use client";

import { Folder } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useItemDrawer } from "@/components/items/item-drawer-provider";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { TYPE_ICONS } from "@/constants/item-types";
import { MIN_QUERY_LENGTH } from "@/lib/validations/search";
import type {
  SearchCollection,
  SearchItem,
  SearchResults,
} from "@/types/search";

/**
 * How long after the last keystroke the query goes to the server. Long enough
 * that typing a word costs one request rather than one per letter, short enough
 * that a pause reads as instant.
 */
const DEBOUNCE_MS = 200;

const ERRORS: Record<number, string> = {
  401: "Your session has expired. Sign in again to search.",
};

const GENERIC_ERROR = "Could not search right now. Try again.";

/**
 * The last request that finished, and the query it answers.
 *
 * Carrying the query is what makes the results self-describing: comparing it
 * against what is in the box says whether they are current, so nothing has to
 * be cleared as the query changes — and the previous results can stay on screen
 * while the next ones are in flight rather than flickering through an empty
 * list on every keystroke.
 */
type SearchResponse =
  | { query: string; status: "ready"; results: SearchResults }
  | { query: string; status: "error"; message: string };

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The ⌘K command palette: one search across the user's items and collections. */
export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);

  const router = useRouter();
  const { openItem } = useItemDrawer();

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!open || trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    // Aborting on cleanup is what keeps a slower earlier response from landing
    // on top of a later one: every keystroke re-runs this effect, which cancels
    // whatever the previous one started.
    const controller = new AbortController();

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await fetch(
            `/api/search?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
          );

          if (!result.ok) {
            setResponse({
              query: trimmed,
              status: "error",
              message: ERRORS[result.status] ?? GENERIC_ERROR,
            });
            return;
          }

          setResponse({
            query: trimmed,
            status: "ready",
            results: (await result.json()) as SearchResults,
          });
        } catch {
          if (controller.signal.aborted) {
            return;
          }

          setResponse({
            query: trimmed,
            status: "error",
            message: GENERIC_ERROR,
          });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed]);

  function handleOpenChange(next: boolean) {
    // Closing throws the query away, so the palette always opens empty rather
    // than on whatever was last searched for.
    if (!next) {
      setQuery("");
      setResponse(null);
    }

    onOpenChange(next);
  }

  function handleSelectItem(item: SearchItem) {
    handleOpenChange(false);

    // `openItem` takes an `ItemSummary`, whose `updatedAt` is a `Date`. This one
    // came over the wire as JSON, so it is a string until it is revived.
    openItem({ ...item, updatedAt: new Date(item.updatedAt) });
  }

  function handleSelectCollection(collection: SearchCollection) {
    handleOpenChange(false);
    router.push(`/collections/${collection.id}`);
  }

  const current = response?.query === trimmed ? response : null;
  const loading = !tooShort && current === null;
  const failure = current?.status === "error" ? current.message : null;

  // Deliberately the last *ready* response rather than the current one, so the
  // list holds still while the next query is in flight.
  const results = response?.status === "ready" ? response.results : null;
  const items = results?.items ?? [];
  const collections = results?.collections ?? [];
  const hasResults = items.length > 0 || collections.length > 0;

  const showResults = !tooShort && !failure;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search your items and collections."
      className="search-palette"
    >
      {/* The server decides the result set, so cmdk must not filter it again —
          its scoring would drop rows that matched on content it cannot see. */}
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search items and collections..."
          value={query}
          onValueChange={setQuery}
        />

        <CommandList>
          {tooShort && (
            <p className="search-status">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          )}

          {!tooShort && failure && <p className="search-status">{failure}</p>}

          {showResults && !hasResults && (
            <p className="search-status">
              {loading
                ? "Searching…"
                : `No items or collections match “${trimmed}”.`}
            </p>
          )}

          {showResults && items.length > 0 && (
            <CommandGroup heading="Items">
              {items.map((item) => (
                <ItemResult
                  key={item.id}
                  item={item}
                  onSelect={() => handleSelectItem(item)}
                />
              ))}
            </CommandGroup>
          )}

          {showResults && collections.length > 0 && (
            <CommandGroup heading="Collections">
              {collections.map((collection) => (
                <CommandItem
                  key={collection.id}
                  value={`collection:${collection.id}`}
                  className="search-result"
                  onSelect={() => handleSelectCollection(collection)}
                >
                  <span className="search-result-icon">
                    <Folder size={16} aria-hidden />
                  </span>

                  <span className="search-result-text">
                    <span className="search-result-title">
                      {collection.name}
                    </span>
                    {collection.description && (
                      <span className="search-result-preview">
                        {collection.description}
                      </span>
                    )}
                  </span>

                  <CommandShortcut className="search-result-count">
                    {collection.itemCount}{" "}
                    {collection.itemCount === 1 ? "item" : "items"}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function ItemResult({
  item,
  onSelect,
}: {
  item: SearchItem;
  onSelect: () => void;
}) {
  const Icon = TYPE_ICONS[item.type.icon];

  return (
    <CommandItem
      value={`item:${item.id}`}
      className="search-result"
      data-type={item.type.slug}
      onSelect={onSelect}
    >
      <span className="search-result-icon">
        {Icon && <Icon size={16} aria-hidden />}
      </span>

      <span className="search-result-text">
        <span className="search-result-title">{item.title}</span>
        {item.preview && (
          <span className="search-result-preview">{item.preview}</span>
        )}
      </span>
    </CommandItem>
  );
}
