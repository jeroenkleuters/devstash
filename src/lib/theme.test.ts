import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  readTheme,
  serverTheme,
  subscribeToTheme,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

/**
 * A `document` and a `localStorage` with just the surface this module touches.
 *
 * Vitest runs in `node`, so neither exists. Stubbing them is what lets the
 * assertions be about the rules rather than about a DOM implementation.
 */
function fakeDom({ storeThrows = false } = {}) {
  const classes = new Set<string>(["dark"]);
  const store = new Map<string, string>();

  const documentStub = {
    documentElement: {
      classList: {
        toggle: (name: string, on: boolean) =>
          on ? classes.add(name) : classes.delete(name),
        contains: (name: string) => classes.has(name),
        remove: (name: string) => classes.delete(name),
        add: (name: string) => classes.add(name),
      },
    },
  };

  const localStorageStub = {
    getItem: (key: string) => {
      if (storeThrows) throw new Error("site data blocked");
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storeThrows) throw new Error("site data blocked");
      store.set(key, value);
    },
  };

  return { classes, store, documentStub, localStorageStub };
}

/**
 * Runs the string that actually ships in the document head, rather than
 * asserting on its text. The two identifiers it reaches for are passed in as
 * parameters, which shadows the globals it would otherwise use.
 */
function runHeadScript({
  stored,
  throws = false,
}: {
  stored?: string;
  throws?: boolean;
}) {
  const classes = new Set<string>(["dark"]);
  const readKeys: string[] = [];

  const localStorageStub = {
    getItem: (key: string) => {
      readKeys.push(key);
      if (throws) throw new Error("site data blocked");
      return stored ?? null;
    },
  };

  const documentStub = {
    documentElement: {
      classList: {
        remove: (name: string) => classes.delete(name),
        add: (name: string) => classes.add(name),
        contains: (name: string) => classes.has(name),
      },
    },
  };

  new Function("localStorage", "document", THEME_SCRIPT)(
    localStorageStub,
    documentStub,
  );

  return { dark: classes.has("dark"), readKeys };
}

describe("THEME_SCRIPT", () => {
  it("leaves the server's dark class alone when nothing is stored", () => {
    expect(runHeadScript({}).dark).toBe(true);
  });

  it("removes the dark class only for an explicit light preference", () => {
    expect(runHeadScript({ stored: "light" }).dark).toBe(false);
  });

  it("leaves dark alone for a stored value it does not recognise", () => {
    // A value written by a later version, or edited by hand. Falling back to
    // the class the server sent is the safe direction: this script can only
    // ever take dark off, never put a theme on.
    expect(runHeadScript({ stored: "sepia" }).dark).toBe(true);
    expect(runHeadScript({ stored: "" }).dark).toBe(true);
  });

  it("reads the same key applyTheme writes", () => {
    // Drift between the two is the setting silently not surviving a reload.
    expect(runHeadScript({}).readKeys).toEqual([THEME_STORAGE_KEY]);
  });

  it("swallows a localStorage that throws rather than failing in the head", () => {
    // A browser set to block site data throws on read. Uncaught, this would be
    // an error in the head on every single page load.
    expect(() => runHeadScript({ throws: true })).not.toThrow();
    expect(runHeadScript({ throws: true }).dark).toBe(true);
  });
});

describe("applyTheme", () => {
  let dom: ReturnType<typeof fakeDom>;

  beforeEach(() => {
    dom = fakeDom();
    vi.stubGlobal("document", dom.documentStub);
    vi.stubGlobal("localStorage", dom.localStorageStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes the class off for light and puts it back for dark", () => {
    applyTheme("light");
    expect(dom.classes.has("dark")).toBe(false);

    applyTheme("dark");
    expect(dom.classes.has("dark")).toBe(true);
  });

  it("remembers the choice for the next load", () => {
    applyTheme("light");
    expect(dom.store.get(THEME_STORAGE_KEY)).toBe("light");
  });

  it("still sets the class when the choice cannot be stored", () => {
    // Site data blocked: the page must still be correct until it is reloaded.
    const blocked = fakeDom({ storeThrows: true });
    vi.stubGlobal("document", blocked.documentStub);
    vi.stubGlobal("localStorage", blocked.localStorageStub);

    expect(() => applyTheme("light")).not.toThrow();
    expect(blocked.classes.has("dark")).toBe(false);
  });

  it("tells subscribers, so the control follows the document", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);

    applyTheme("light");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    applyTheme("dark");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies even when the write was refused", () => {
    // The class changed, so the switch is out of step until it is told.
    const blocked = fakeDom({ storeThrows: true });
    vi.stubGlobal("document", blocked.documentStub);
    vi.stubGlobal("localStorage", blocked.localStorageStub);

    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);

    applyTheme("light");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});

describe("readTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports what the document says", () => {
    const dom = fakeDom();
    vi.stubGlobal("document", dom.documentStub);

    expect(readTheme()).toBe("dark");

    dom.classes.delete("dark");
    expect(readTheme()).toBe("light");
  });
});

describe("serverTheme", () => {
  it("is dark, which is the class the layout renders", () => {
    // The server snapshot has to match the markup or the first client render
    // differs from it. The layout hardcodes `dark` on <html>.
    expect(serverTheme()).toBe("dark");
  });
});
