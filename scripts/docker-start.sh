#!/bin/sh
set -e

# 1. Start geometry-service (FastAPI) w tle
uvicorn services.geometry.main:app --host 0.0.0.0 --port 8000 &

# 2. Start Node/Express
echo "Starting Node backend on PORT=${PORT:-3000}..."
node web/server.js
