#!/usr/bin/env bash
# Deploys the LiarBar backend from origin/main. Run by GitHub Actions CD
# (or manually: bash ~/deploy-liarbar.sh).
set -euo pipefail

echo "==> Pulling latest main"
cd ~/LiarBar
git fetch origin main
git reset --hard origin/main

echo "==> Building image"
cd server
docker build -t liarbar-server .

echo "==> Restarting container"
docker rm -f liarbar 2>/dev/null || true
docker run -d --name liarbar --restart unless-stopped \
  --network travelhub-prod_default \
  -p 127.0.0.1:3001:3001 \
  --env-file ~/liarbar.env \
  liarbar-server

echo "==> Health check"
sleep 3
curl -sf http://127.0.0.1:3001/api/health
echo
echo "==> Cleaning old images"
docker image prune -f > /dev/null

echo "DEPLOY OK $(date -u +%Y-%m-%dT%H:%M:%SZ) commit $(git rev-parse --short HEAD)"
