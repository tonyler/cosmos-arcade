#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"
SERVER="$ROOT/server"

echo ">>> Stopping cosmos-arcade..."
pm2 stop cosmos-arcade

echo ""
echo ">>> Building frontend..."
cd "$FRONTEND"
npm run build

echo ""
echo ">>> Building server..."
cd "$SERVER"
npm run build

echo ""
echo ">>> Starting cosmos-arcade..."
pm2 start cosmos-arcade

echo ""
echo ">>> Done. Logs: pm2 logs cosmos-arcade"
