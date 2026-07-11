#!/usr/bin/env bash
# Pull and run coturn as a Docker container for LiarBar voice chat.
# Prereqs on the VM:
#   1. /etc/turnserver.conf exists with placeholders filled (see turnserver.conf).
#   2. ufw + Azure NSG allow: 3478/udp, 3478/tcp, 49160-49200/udp.
# Run ON THE VM:  bash run-coturn.sh
set -euo pipefail

if grep -q '__PUBLIC_IP__\|__REALM__\|__TURN_' /etc/turnserver.conf 2>/dev/null; then
  echo "!! /etc/turnserver.conf still has __PLACEHOLDERS__ — fill them first." >&2
  exit 1
fi

echo "==> (re)starting coturn container"
docker rm -f coturn 2>/dev/null || true
docker run -d --name coturn --restart unless-stopped --network host \
  -v /etc/turnserver.conf:/etc/turnserver.conf:ro \
  coturn/coturn -c /etc/turnserver.conf

sleep 3
docker ps --filter name=coturn --format "{{.Names}} {{.Image}} {{.Status}}"
echo "==> listening check:"
sudo ss -lunp | grep 3478 || echo "!! not listening on udp/3478"
echo "==> verify externally at:"
echo "   https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "   URI turn:<PUBLIC_IP>:3478 — success = a candidate of type 'relay'"
