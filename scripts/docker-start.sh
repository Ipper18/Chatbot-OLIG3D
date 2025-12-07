#!/usr/bin/env bash
set -e

# Start geometry-service (FastAPI) w tle
python3 -m uvicorn services.geometry.main:app \
  --host 0.0.0.0 \
  --port 8000 &

# Start backendu Node/Express
node web/server.js
