const locks = new Map<string, Promise<unknown>>();
export async function withAppLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const before = locks.get(id) ?? Promise.resolve();
  const current = before.catch(() => undefined).then(operation);
  locks.set(id, current);
  try { return await current; }
  finally { if (locks.get(id) === current) locks.delete(id); }
}
