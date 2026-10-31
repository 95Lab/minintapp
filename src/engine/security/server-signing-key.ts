// One server-side secret for every HMAC the app issues (photo URLs, host session cookies). Each use
// derives its own key with a purpose label, so a signature made for one purpose never verifies for another.
import "server-only";
import { randomBytes } from "node:crypto";
import { runtimeConfig } from "@/engine/config/runtime-config";

const DEFAULT_SALT = "minint-dev-salt";
const processKey = randomBytes(32).toString("hex");

/**
 * A configured IP_HASH_SALT (stable across Auth configuration changes), else the legacy Supabase service key, else
 * a random per-process key (memory mode: nothing signed outlives the process anyway). Never the public
 * default salt.
 */
export const signingKeyFor = (purpose: string) =>
  `${purpose}:${(runtimeConfig.ipHashSalt !== DEFAULT_SALT ? runtimeConfig.ipHashSalt : runtimeConfig.supabaseServiceRoleKey || processKey)}`;
