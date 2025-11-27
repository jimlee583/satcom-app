#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if ! command -v uvicorn >/dev/null 2>&1; then
  echo "uvicorn is not installed or not on PATH. Install backend deps first." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed or not on PATH. Install Node.js to run the frontend." >&2
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  for var in BACKEND_PID FRONTEND_PID; do
    pid="${!var:-}"
    if [[ -n "$pid" ]]; then
      if kill -0 "$pid" >/dev/null 2>&1; then
        printf 'Stopping %s (pid %s)...\n' "${var%_PID}" "$pid"
        kill "$pid" >/dev/null 2>&1 || true
        wait "$pid" >/dev/null 2>&1 || true
      fi
      printf -v "$var" ''
    fi
  done
}

cleanup_and_exit() {
  trap - EXIT
  cleanup
  exit "$1"
}

on_signal() {
  echo -e "\nSignal received. Shutting down dev servers..."
  cleanup_and_exit 0
}

trap cleanup EXIT
trap on_signal SIGINT SIGTERM

echo "Starting FastAPI backend at ${BACKEND_HOST}:${BACKEND_PORT}..."
(
  cd "$BACKEND_DIR"
  uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Starting Vite frontend at ${FRONTEND_HOST}:${FRONTEND_PORT}..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo
echo "Both dev servers are running."
echo "Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "Press Ctrl+C to stop both."

set +e
wait -n
STATUS=$?
set -e

echo "A service exited (status $STATUS). Shutting down the remaining service..."
cleanup_and_exit "$STATUS"

