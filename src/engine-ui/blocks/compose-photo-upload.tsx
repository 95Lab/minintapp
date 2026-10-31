"use client";
// Photo input plumbing: the participant page provides an upload function for the block (context, so the
// forms between don't need to carry it), and the photo field resizes on the phone before sending —
// ≤ 1024 px JPEG keeps uploads small (~100–250 KB) and strips the original's metadata (location…).
import { createContext, useContext } from "react";

export type PhotoUploadResult = { photoId: string } | { code: string; params?: Record<string, string | number> };
export type PhotoUploader = (photo: Blob) => Promise<PhotoUploadResult>;

export const PhotoUploadContext = createContext<PhotoUploader | null>(null);
export const usePhotoUploader = () => useContext(PhotoUploadContext);

const MAX_SIDE = 1024;

/** Re-encodes an image to a ≤ 1024 px JPEG; drawing to a canvas drops EXIF data (e.g. GPS). */
export async function resizePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.8));
}
