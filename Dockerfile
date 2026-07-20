FROM node:24-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

FROM base AS build
RUN apt-get update && apt-get install -y build-essential python3 \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build && pnpm build:worker

FROM base AS production
RUN apt-get update && apt-get install -y tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build /app/build
COPY --from=build /app/build-worker /app/build-worker
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=build /app/src/lib/server/env.ts /app/src/lib/server/env.ts
COPY --from=build /app/src/lib/server/db /app/src/lib/server/db
COPY scripts/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
VOLUME /app/.renarr-data
ENTRYPOINT ["tini", "--", "/app/entrypoint.sh"]
