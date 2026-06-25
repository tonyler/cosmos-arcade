#!/usr/bin/env bash
set -euo pipefail

echo ">>> Restarting cosmos-arcade..."
pm2 restart cosmos-arcade
echo ">>> Done. Logs: pm2 logs cosmos-arcade"
