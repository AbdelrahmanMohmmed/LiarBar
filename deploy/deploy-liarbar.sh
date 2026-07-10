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

echo "==> Health check (up to 30s)"
healthy=0
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:3001/api/health; then
    echo
    healthy=1
    break
  fi
  sleep 2
done
if [ "$healthy" != "1" ]; then
  echo "HEALTH CHECK FAILED — recent container logs:"
  docker logs liarbar 2>&1 | tail -20
  exit 1
fi
echo "==> Cleaning old images"
docker image prune -f > /dev/null

echo "DEPLOY OK $(date -u +%Y-%m-%dT%H:%M:%SZ) commit $(git rev-parse --short HEAD)"
