import { loadRuntime } from "./server.js";
try {
  const { server, repository, port, hostname } = loadRuntime();
  server.listen(port, hostname, () => console.info(`Poll runtime listening on port ${port}`));
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => { repository.close(); });
    server.closeIdleConnections();
    setTimeout(() => { server.closeAllConnections(); }, 5000).unref();
  };
  process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
  server.on("error", () => { console.error("Poll runtime could not listen"); repository.close(); process.exitCode = 1; });
} catch { console.error("Poll runtime could not start; check manifest, host token and writable data volume"); process.exitCode = 1; }
