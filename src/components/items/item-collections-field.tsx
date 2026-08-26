"use client";

import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import type { CollectionOption } from "@/types/collection";

/** What the list says while it is still on its way. */
const LOADING = "Loading collections…";

const FAILED = "Could not load your collections.";

const EMPTY = "No collections yet. Create one from the top bar first.";

interface ItemCollectionsFieldProps {
  selected: string[];
  onChange: (collectionIds: string[]) => void;
  /** Namespaces the checkbox ids, so two mounted forms cannot collide. */
  idPrefix: string;
}

/**
 * The collections an item is filed into, as a checkbox list.
 *
 * Fetches its own options rather than taking them as props: both forms need the
 * same list and neither has it — the create dialog is opened from a server
 * component and the drawer's edit mode from a client one, so passing it down
 * would mean two different routes to the same data. Fetching on mount also
 * means a collection created since the page loaded is in the list, since Radix
 * unmounts both forms on close.
 *
 * Real checkboxes inside their labels, not a custom control: the group keeps
 * its keyboard behaviour and focus lands somewhere visible, which is the same
 * shape the item type picker uses for its radios.
 */
export function ItemCollectionsField({
  selected,
  onChange,
  idPrefix,
}: ItemCollectionsFieldProps) {
  const [options, setOptions] = useState<CollectionOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guards against a response landing after the form has gone, which React
    // would otherwise warn about and which has nowhere to render anyway.
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/collections");

        if (!response.ok) {
          throw new Error(`Collections request failed: ${response.status}`);
        }

        const data: CollectionOption[] = await response.json();

        if (active) setOptions(data);
      } catch {
        if (active) setError(FAILED);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function toggle(id: string, checked: boolean) {
    onChange(
      checked ? [...selected, id] : selected.filter((current) => current !== id),
    );
  }

  return (
    <div className="item-form-field">
      {/* No single control to point at: each checkbox carries its own label,
          so this one names the group rather than pairing with an input — the
          same shape the Content label takes over an editor. */}
      <Label htmlFor={undefined}>Collections</Label>

      {error ? (
        <p className="item-form-hint" role="alert">
          {error}
        </p>
      ) : options === null ? (
        <p className="item-form-hint">{LOADING}</p>
      ) : options.length === 0 ? (
        <p className="item-form-hint">{EMPTY}</p>
      ) : (
        <div className="item-collections-options">
          {options.map((option) => (
            <label
              key={option.id}
              className="item-collections-option"
              htmlFor={`${idPrefix}-collection-${option.id}`}
            >
              <input
                type="checkbox"
                id={`${idPrefix}-collection-${option.id}`}
                name="collectionIds"
                value={option.id}
                checked={selected.includes(option.id)}
                onChange={(event) => toggle(option.id, event.target.checked)}
              />
              {option.name}
            </label>
          ))}
        </div>
      )}

      <p className="item-form-hint">
        Optional. An item can sit in as many collections as you like.
      </p>
    </div>
  );
}
