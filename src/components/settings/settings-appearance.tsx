"use client";

import { useId, useSyncExternalStore } from "react";

import { Label } from "@/components/ui/label";
import {
  applyTheme,
  readTheme,
  serverTheme,
  subscribeToTheme,
} from "@/lib/theme";

/**
 * Light or dark, for the app's own pages.
 *
 * Nothing is written to the account: the value lives in `localStorage`, so it
 * is per browser rather than per user, and a blocking script in the document
 * head applies it before paint. That is the whole reason it is not a server
 * action like the cards around it — a preference read inside the request cannot
 * beat the first paint on a signed-out page.
 *
 * The class on `<html>` is read through `useSyncExternalStore` rather than
 * copied into state, because that is what it is — the head script sets it
 * before React exists, so state seeded during render would hydrate against a
 * value the server never sent. The server snapshot is dark, which is exactly
 * what the markup carries.
 */
export function SettingsAppearance() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, serverTheme);
  const switchId = useId();

  return (
    <section className="settings-card">
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">Appearance</h2>
          <p className="settings-row-description">
            How DevSquirrel looks. Saved in this browser rather than to your
            account, so it does not follow you to another device.
          </p>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={switchId} className="settings-row-title">
            Dark mode
          </Label>
          <p className="settings-row-description">
            Turn this off for the light theme. The marketing and sign-in pages
            stay dark either way.
          </p>
        </div>

        <input
          id={switchId}
          type="checkbox"
          role="switch"
          className="settings-switch"
          checked={theme === "dark"}
          onChange={(event) =>
            applyTheme(event.target.checked ? "dark" : "light")
          }
        />
      </div>
    </section>
  );
}
