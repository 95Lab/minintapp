// Channel/event names shared by the server broadcaster and the browser subscriber.
export const APP_CHANGED_EVENT = "changed";
/** app:{id} — control signals for every screen; app:{id}:host — results signals for the host screen only. */
export const appChannelName = (appId: string, audience: "all" | "host" = "all") => (audience === "host" ? `app:${appId}:host` : `app:${appId}`);
