import { defineConfig } from "vitest/config";
import base from "./vitest.config";
// Replace include rather than concatenating it: live checks must never run offline suites
// against a real project merely because they inherit this base configuration.
export default defineConfig({ ...base, test: { ...base.test, include: ["tests/integration/supabase.test.ts"], testTimeout: 30000, hookTimeout: 15000, fileParallelism: false } });
