// Anonymous participant identity: one random token per app, kept in localStorage.
// Weak by design (clearing storage = new identity); documented as an accepted risk.
import { nanoid } from "nanoid";

const key = (appId: string) => `minint:p:${appId}`;
const NAME_KEY = "minint:name";

function safeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: identity lasts for this page only */
  }
}

const memory = new Map<string, string>();

export {getParticipantToken} from "@/lib/participant/participant-token";

export const getDisplayName = () => safeGet(NAME_KEY) ?? "";
export const setDisplayName = (name: string) => safeSet(NAME_KEY, name.trim().slice(0, 40));
