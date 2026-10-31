// Props every brick's UI receives from the host / participant renderers.
import type { AppRuntime, ResponsePayload } from "@/engine/api/api-contract-types";
import type { UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import type { PublicPayee } from "@/engine/money/payee";

export interface ParticipantBlockProps<B, R> {
  block: B;
  results: R | null;
  runtime: AppRuntime;
  /** this participant's answers keyed `${blockId}:${itemId}` */
  myAnswers: Record<string, ResponsePayload>;
  open: boolean;
  locale: UiLocale;
  /** app id and this person's display name ("" if none): custom pages load by app id and greet by name */
  appId: string;
  displayName: string;
  onSubmit: (itemId: string, payload: ResponsePayload) => Promise<boolean>;
  /** photo inputs: uploads a resized photo for this block, returns its id or an error code */
  onUpload?: (photo: Blob) => Promise<{ photoId: string } | { code: string; params?: Record<string, string | number> }>;
  /** the host's payee account and the app title: a settle view builds its payment QR from them */
  payee?: PublicPayee | null;
  appTitle?: string;
}

export interface HostBlockProps<B, R> {
  block: B;
  results: R | null;
  runtime: AppRuntime;
  locale: UiLocale;
  appId: string;
  busy: boolean;
  canControl: boolean;
  /** settle view: the host can still confirm received payments after closing the log (not once the app has ended) */
  canSettle?: boolean;
  /** runs a host action of this brick (block-action route) */
  onAction: (action: string, args?: Record<string, string | number | boolean>) => void;
  payee?: PublicPayee | null;
  appTitle?: string;
}
