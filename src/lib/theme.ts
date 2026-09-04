/**
 * The light/dark switch, which is deliberately the simple version.
 *
 * `<html>` ships with `dark` on it and this only ever takes it off, so dark
 * stays the default and an unconfigured or storage-less browser gets what the
 * app has always looked like. The value lives in `localStorage` rather than on
 * the `User` row the editor, upload and AI preferences use, because a theme has
 * to be applied before first paint or the page flashes the wrong one — a
 * server-read value cannot do that on a signed-out page, which has no user to
 * read.
 *
 * @see context/features/light-mode-spec.md — the fuller version, which adds
 * follow-the-system, the Monaco theme and the `--type-*` colours on white.
 */
export const THEME_STORAGE_KEY = "devsquirrel-theme";

export type Theme = "dark" | "light";

/**
 * Applied before paint by a blocking script in the document head, so it is
 * written as a string rather than imported — nothing else may run first.
 *
 * Wrapped in try/catch because reading `localStorage` *throws* rather than
 * returning nothing in a browser set to block site data, and a throw here would
 * be an uncaught error in the head on every page load.
 */
export const THEME_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

/** Puts the class in step with a choice, and remembers it for the next load. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Site data blocked. The class is already set, so the page is correct until
    // it is reloaded — which is the most that can be offered here.
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * The class on `<html>` read as an external store, which is what it is: the
 * head script sets it before React exists, so a component cannot hold it in
 * state without rendering one value on the server and finding another on the
 * client.
 *
 * Only `applyTheme` changes it, so subscribing is just a list of things to tell
 * — there is no DOM observer here, and a change made from the console will not
 * be noticed.
 */
const listeners = new Set<() => void>();

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** What the document currently says. Browser only. */
export function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * What the server rendered, which is always dark — the class is in the markup
 * and the script that may remove it has not run yet. Returning this rather than
 * guessing keeps the first client render identical to the server's.
 */
export function serverTheme(): Theme {
  return "dark";
}
