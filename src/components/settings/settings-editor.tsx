"use client";

import { useId } from "react";

import { useEditorPreferences } from "@/components/editor/editor-preferences-provider";
import { Label } from "@/components/ui/label";
import {
  EDITOR_THEMES,
  FONT_SIZES,
  TAB_SIZES,
  type EditorTheme,
  type FontSize,
  type TabSize,
} from "@/lib/validations/editor-preferences";

const THEME_LABELS: Record<EditorTheme, string> = {
  "vs-dark": "VS Dark",
  monokai: "Monokai",
  "github-dark": "GitHub Dark",
};

/**
 * How code is shown wherever the app renders an editor — the drawer's view of a
 * snippet as well as the item forms.
 *
 * There is no save button: every control writes as it changes, which is also
 * why the editors follow it live rather than after a reload. The section is a
 * client component because it both reads and sets the context the editors read.
 */
export function SettingsEditor() {
  const { preferences, setPreference, saving } = useEditorPreferences();

  const fontSizeId = useId();
  const tabSizeId = useId();
  const themeId = useId();
  const wordWrapId = useId();
  const minimapId = useId();

  return (
    <section className="settings-card" aria-busy={saving}>
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">Editor</h2>
          <p className="settings-row-description">
            How code is shown everywhere in the app. Changes save as you make
            them.
          </p>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={fontSizeId} className="settings-row-title">
            Font size
          </Label>
          <p className="settings-row-description">
            The size code is set in, in pixels
          </p>
        </div>

        <select
          id={fontSizeId}
          className="settings-select"
          value={preferences.fontSize}
          onChange={(event) =>
            setPreference("fontSize", Number(event.target.value) as FontSize)
          }
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={tabSizeId} className="settings-row-title">
            Tab size
          </Label>
          <p className="settings-row-description">
            How wide one level of indentation renders
          </p>
        </div>

        <select
          id={tabSizeId}
          className="settings-select"
          value={preferences.tabSize}
          onChange={(event) =>
            setPreference("tabSize", Number(event.target.value) as TabSize)
          }
        >
          {TAB_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} spaces
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={themeId} className="settings-row-title">
            Theme
          </Label>
          <p className="settings-row-description">
            The colour scheme the editor highlights code with
          </p>
        </div>

        <select
          id={themeId}
          className="settings-select"
          value={preferences.theme}
          onChange={(event) =>
            setPreference("theme", event.target.value as EditorTheme)
          }
        >
          {EDITOR_THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {THEME_LABELS[theme]}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={wordWrapId} className="settings-row-title">
            Word wrap
          </Label>
          <p className="settings-row-description">
            Wrap long lines instead of scrolling sideways to read them
          </p>
        </div>

        {/* A real checkbox drawn as a switch, so it keeps the keyboard and
            form behaviour a hand-built toggle would have to reimplement. */}
        <input
          id={wordWrapId}
          type="checkbox"
          role="switch"
          className="settings-switch"
          checked={preferences.wordWrap}
          onChange={(event) => setPreference("wordWrap", event.target.checked)}
        />
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={minimapId} className="settings-row-title">
            Minimap
          </Label>
          <p className="settings-row-description">
            Show the scaled-down overview down the right-hand edge
          </p>
        </div>

        <input
          id={minimapId}
          type="checkbox"
          role="switch"
          className="settings-switch"
          checked={preferences.minimap}
          onChange={(event) => setPreference("minimap", event.target.checked)}
        />
      </div>
    </section>
  );
}
