#!/usr/bin/env bash
set -euo pipefail

echo "[START] geometry-service + Node backend"

# 1) startujemy geometry-service w tle
uvicorn services.geometry.main:app --host 0.0.0.0 --port 8000 &
GEOM_PID=$!
echo "[INFO] geometry-service pid=$GEOM_PID"

# 2) uruchamiamy Node jako główny proces kontenera
echo "[INFO] starting Node server"
exec node web/server.js
