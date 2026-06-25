#!/usr/bin/env bash
set -euo pipefail

echo ">>> Stopping cosmos-arcade..."
pm2 stop cosmos-arcade
echo ">>> Stopped."
