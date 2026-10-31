// Run once as the owner of the central secrets file. No values are printed.
import { readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const path = process.argv[2];
if (!path || !(await lstat(path)).isFile()) throw new Error('A regular secrets file is required');
const values = parseEnv(await readFile(path, 'utf8'));
const aliases = { MININTAPP_POSTGRES_PASSWORD: 'POSTGRES_PASSWORD', MININTAPP_REDIS_PASSWORD: 'REDIS_PASSWORD', MININTAPP_WORKER_TOKEN: 'WORKER_TOKEN', MININTAPP_SIGNING_SECRET: 'IP_HASH_SALT', MININTAPP_S3_ACCESS_KEY_ID: 'S3_ACCESS_KEY_ID', MININTAPP_S3_SECRET_ACCESS_KEY: 'S3_SECRET_ACCESS_KEY' };
for (const [old, standard] of Object.entries(aliases)) {
  if (values[old] && values[standard] && values[old] !== values[standard]) throw new Error('Conflicting environment names');
  if (values[old]) values[standard] = values[old];
  delete values[old];
}
for (const name of ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'WORKER_TOKEN', 'IP_HASH_SALT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) if (!values[name]) throw new Error(`Missing ${name}`);
values.DATABASE_URL ||= `postgresql://minintapp:${encodeURIComponent(values.POSTGRES_PASSWORD)}@127.0.0.1:15432/minintapp`;
values.REDIS_URL ||= `redis://:${encodeURIComponent(values.REDIS_PASSWORD)}@127.0.0.1:16379`;
const temporary = `${path}.next`;
await writeFile(temporary, Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n')+'\n', { mode: 0o600, flag: 'wx' });
await rename(temporary, path);
console.log('Environment names migrated; secret values were not printed.');
