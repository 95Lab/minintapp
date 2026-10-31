"use client";
// Photo input on the phone: pick or take a photo → resized on the device → uploaded → its id becomes
// the field's value (sent with the form). Shows a local preview; errors are worded from the API's code.
import { useEffect, useState, type ReactNode } from "react";
import { errorText } from "@/engine/api/app-error-codes";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { resizePhoto, usePhotoUploader } from "./compose-photo-upload";

export function ComposePhotoField(props: { fieldId: string; label: ReactNode; value: string; onChange: (photoId: string) => void; disabled: boolean; locale: UiLocale }) {
  const { fieldId, label, value, onChange, disabled, locale } = props;
  const s = t(locale);
  const upload = usePhotoUploader();
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "ready" | "failed">(value ? "ready" : "idle");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function pick(file: File | undefined) {
    if (!file || !upload) return;
    setStatus("uploading");
    setProblem(null);
    try {
      const small = await resizePhoto(file);
      const result = await upload(small);
      if ("photoId" in result) {
        setPreview(URL.createObjectURL(small));
        setStatus("ready");
        onChange(result.photoId);
      } else {
        setStatus("failed");
        setProblem(errorText(result.code, locale, result.params));
      }
    } catch {
      // not an image the browser can decode (e.g. some HEIC files)
      setStatus("failed");
      setProblem(errorText("photo_not_image", locale));
    }
  }

  return (
    <div className="field photo-field">
      {label}
      {preview && <img src={preview} alt="" />}
      <input
        id={fieldId}
        type="file"
        accept="image/*"
        disabled={disabled || status === "uploading" || !upload}
        onChange={(e) => void pick(e.target.files?.[0])}
        aria-describedby={`${fieldId}-status`}
      />
      <div id={`${fieldId}-status`} className="muted" role="status" style={{ fontSize: 14 }}>
        {status === "uploading" ? s.composePhotoUploading : status === "ready" ? s.composePhotoReady : status === "failed" ? `${s.composePhotoFailed} ${problem ?? ""}` : s.composePhotoPick}
      </div>
    </div>
  );
}
