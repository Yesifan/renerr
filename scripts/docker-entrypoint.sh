#!/bin/sh
set -e

mkdir -p .renarr-data

pnpm db:push || echo "DB push skipped"

node build-worker/index.js &
WORKER_PID=$!

trap 'kill $WORKER_PID; exit 0' SIGTERM SIGINT

exec node build/index.js
