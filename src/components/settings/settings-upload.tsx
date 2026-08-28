"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveUploadPreferences } from "@/actions/upload-preferences";
import { Label } from "@/components/ui/label";
import {
  UPLOAD_COUNTS,
  UPLOAD_WINDOWS,
  uploadWindowLabel,
  type UploadCount,
  type UploadPreferences,
  type UploadWindow,
} from "@/lib/validations/upload-preferences";

/** Said when the action never answered, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

interface SettingsUploadProps {
  /** What the account has stored, already defaulted. */
  preferences: UploadPreferences;
}

/**
 * How many uploads the account may start in one window.
 *
 * The controls offer a fixed set rather than a number field, and that is the
 * point rather than a shortcut: the limit exists to stop an account filling the
 * bucket, so the ceiling has to stay the app's. The schema behind the action
 * accepts only what is offered here, so the widest thing this card can ask for
 * is the widest thing on it.
 *
 * There is no save button — each control writes as it changes, matching the
 * editor card. It holds its own state rather than reading a context, because
 * nothing else on the page renders these: the only other reader is the upload
 * route, on the server.
 */
export function SettingsUpload({ preferences }: SettingsUploadProps) {
  const [values, setValues] = useState(preferences);
  const [saving, startSaving] = useTransition();

  const limitId = useId();
  const windowId = useId();

  function save(next: UploadPreferences) {
    // Applied first so the control follows the pointer, and put back below if
    // the write is refused — there is nothing to wait for on screen.
    const previous = values;

    setValues(next);

    startSaving(async () => {
      // The action answers a failed *write* with `{ success: false }`, but a
      // failed *request* rejects instead. Without this the rejection is
      // unhandled and the card keeps showing a value the server never stored.
      const result = await saveUploadPreferences(next).catch(() => null);

      if (!result?.success) {
        setValues(previous);
        toast.error(result?.error ?? UNREACHABLE);
      }
    });
  }

  return (
    <section className="settings-card" aria-busy={saving}>
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">Uploads</h2>
          <p className="settings-row-description">
            How many files you can upload in one go. Raise it if you add files
            in large batches. Changes save as you make them.
          </p>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={limitId} className="settings-row-title">
            Uploads per window
          </Label>
          <p className="settings-row-description">
            The most files you can start uploading before you have to wait
          </p>
        </div>

        <select
          id={limitId}
          className="settings-select"
          value={values.limit}
          onChange={(event) =>
            save({
              ...values,
              limit: Number(event.target.value) as UploadCount,
            })
          }
        >
          {UPLOAD_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count} files
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <Label htmlFor={windowId} className="settings-row-title">
            Window
          </Label>
          <p className="settings-row-description">
            How long that count is measured over
          </p>
        </div>

        <select
          id={windowId}
          className="settings-select"
          value={values.windowMs}
          onChange={(event) =>
            save({
              ...values,
              windowMs: Number(event.target.value) as UploadWindow,
            })
          }
        >
          {UPLOAD_WINDOWS.map((windowMs) => (
            <option key={windowMs} value={windowMs}>
              {uploadWindowLabel(windowMs)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
