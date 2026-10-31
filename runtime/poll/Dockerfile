# syntax=docker/dockerfile:1
FROM node:22.23.4-bookworm-slim AS builder
WORKDIR /build
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY runtime/poll ./runtime/poll
COPY src/lib/blocks/poll-runtime-schema.ts ./src/lib/blocks/poll-runtime-schema.ts
COPY src/lib/api/poll-runtime-contract.ts ./src/lib/api/poll-runtime-contract.ts
COPY src/lib/deployments/deployment-schema.ts ./src/lib/deployments/deployment-schema.ts
COPY scripts/build-poll-runtime.mjs ./scripts/build-poll-runtime.mjs
RUN node scripts/build-poll-runtime.mjs

FROM node:22.23.4-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder --chown=node:node /build/.runtime-build/ ./
COPY --from=builder /build/node_modules/zod/ ./node_modules/zod/
COPY --from=builder /build/node_modules/server-only/ ./node_modules/server-only/
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{const b=await r.json();if(!r.ok||b.service!=='minint-poll-runtime')process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--conditions=react-server", "runtime/poll/main.js"]
