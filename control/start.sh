#!/usr/bin/env bash
set -euo pipefail

echo ">>> Starting cosmos-arcade..."
pm2 start cosmos-arcade
echo ">>> Started. Logs: pm2 logs cosmos-arcade"
