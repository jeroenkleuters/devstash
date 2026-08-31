"use client";

import { Camera } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { acceptAttribute } from "@/lib/file-constraints";

interface CameraButtonProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Take a photo, as a control of its own rather than an option buried in the
 * picker's sheet.
 *
 * `capture="environment"` asks for the rear camera directly, which is what
 * makes this different from the upload zone beside it: that opens the picker,
 * where a photo is one choice among the gallery and the file browser.
 *
 * Hidden where there is no camera through `(pointer: coarse)` in CSS rather
 * than a check in JavaScript: there is no way to ask whether a camera exists
 * without prompting for permission, and a media query costs no hydration.
 */
export function CameraButton({
  onCapture,
  disabled = false,
  label = "Take photo",
}: CameraButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="camera-button">
      <input
        ref={inputRef}
        type="file"
        className="camera-button-input"
        accept={acceptAttribute("image")}
        capture="environment"
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onCapture(file);
          }

          // Cleared so retaking the same shot fires a change event again — the
          // camera app hands back the same filename every time.
          event.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Camera size={16} aria-hidden />
        {label}
      </Button>
    </div>
  );
}
