// Snapshot commits already broadcast atomically from PostgreSQL. No second send is needed.
export type ChangeKind = "control" | "results";
export async function broadcastAppChanged(_appId:string, _kind:ChangeKind = "control") {}
