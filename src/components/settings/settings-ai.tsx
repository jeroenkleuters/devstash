"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveAiPreferences } from "@/actions/ai-preferences";
import { Label } from "@/components/ui/label";
import { UNREACHABLE } from "@/constants/messages";
import type { AiPreferences } from "@/types/ai";

interface SettingsAiProps {
  /** What the account has stored, already defaulted. */
  preferences: AiPreferences;
}

/**
 * Whether AI features are offered at all.
 *
 * One switch for all four, and it is a standing *"do not even offer it"* rather
 * than the thing authorising any single call — every AI action is started by a
 * click, so the click is the consent. With this off the buttons **do not render
 * at all** rather than rendering inert, which is what makes it an off switch
 * instead of a disabled-button switch; the server check every action makes is
 * then belt-and-braces for a stale page, which is what it should be.
 *
 * No save button — it writes as it changes, matching the editor and upload
 * cards. It holds its own state rather than reading `BillingProvider`, which
 * carries the value *down* to the controls that hide themselves; the round trip
 * back up would be a second source of truth for one boolean.
 */
export function SettingsAi({ preferences }: SettingsAiProps) {
  const [enabled, setEnabled] = useState(preferences.enabled);
  const [saving, startSaving] = useTransition();

  const switchId = useId();

  function save(next: boolean) {
    // Applied first so the switch follows the pointer, and put back below if
    // the write is refused — there is nothing to wait for on screen.
    const previous = enabled;

    setEnabled(next);

    startSaving(async () => {
      // The action answers a failed *write* with `{ success: false }`, but a
      // failed *request* rejects instead. Without this the rejection is
      // unhandled and the switch keeps showing a value the server never stored.
      const result = await saveAiPreferences({ enabled: next }).catch(
        () => null,
      );

      if (!result?.success) {
        setEnabled(previous);
        toast.error(result?.error ?? UNREACHABLE);
      }
    });
  }

  return (
    <section className="settings-card" aria-busy={saving}>
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">AI</h2>
          <p className="settings-row-description">
            AI features suggest tags, summaries and explanations for an item you
            are working on. Changes save as you make them.
          </p>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={switchId} className="settings-row-title">
            AI features
          </Label>
          <p className="settings-row-description">
            Let DevSquirrel send an item&apos;s content to OpenAI when you ask for
            tags, a summary or an explanation. Nothing is sent unless you click.{" "}
            <Link href="/privacy" className="settings-row-link">
              What we share
            </Link>
          </p>
        </div>

        <input
          id={switchId}
          type="checkbox"
          role="switch"
          className="settings-switch"
          checked={enabled}
          onChange={(event) => save(event.target.checked)}
        />
      </div>
    </section>
  );
}
