"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { saveEditorPreferences } from "@/actions/editor-preferences";
import { UNREACHABLE } from "@/constants/messages";
import type { EditorPreferences } from "@/lib/validations/editor-preferences";

interface EditorPreferencesContextValue {
  preferences: EditorPreferences;
  /** Applies one preference everywhere and saves the whole set. */
  setPreference: <K extends keyof EditorPreferences>(
    key: K,
    value: EditorPreferences[K],
  ) => void;
  /** Whether a save is in flight, so the settings rows can say so. */
  saving: boolean;
}

const EditorPreferencesContext =
  createContext<EditorPreferencesContextValue | null>(null);

export function useEditorPreferences(): EditorPreferencesContextValue {
  const context = useContext(EditorPreferencesContext);

  if (!context) {
    throw new Error(
      "useEditorPreferences must be used within EditorPreferencesProvider",
    );
  }

  return context;
}

/**
 * Holds the account's editor settings for the client components that read them
 * — the editors, which are deep inside the drawer and the item forms, and the
 * settings rows that change them.
 *
 * The initial value is read on the server and passed in, so an editor never
 * renders with the defaults and then jumps to the account's own.
 *
 * There is no save button: `setPreference` applies the change immediately and
 * writes it, so the editors follow the dropdown as it moves. A rejected write
 * puts the previous value back rather than leaving the screen showing something
 * that was not stored.
 */
export function EditorPreferencesProvider({
  initialPreferences,
  children,
}: {
  initialPreferences: EditorPreferences;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, startSaving] = useTransition();

  const setPreference = useCallback<
    EditorPreferencesContextValue["setPreference"]
  >(
    (key, value) => {
      if (preferences[key] === value) {
        return;
      }

      const next = { ...preferences, [key]: value };

      // Applied first so the editors follow the control as it moves, then
      // written. Both happen outside the state updater on purpose: React is
      // free to call an updater twice, which would save twice and toast twice.
      setPreferences(next);

      startSaving(async () => {
        // A failed *write* answers `{ success: false }`, but a failed *request*
        // rejects — without the catch that rejection is unhandled and the
        // screen keeps a value the server never stored.
        const result = await saveEditorPreferences(next).catch(() => null);

        if (result?.success) {
          toast.success("Editor preferences saved");
          return;
        }

        toast.error(result?.error ?? UNREACHABLE);
        setPreferences(preferences);
      });
    },
    [preferences],
  );

  const value = useMemo(
    () => ({ preferences, setPreference, saving }),
    [preferences, setPreference, saving],
  );

  return (
    <EditorPreferencesContext.Provider value={value}>
      {children}
    </EditorPreferencesContext.Provider>
  );
}
