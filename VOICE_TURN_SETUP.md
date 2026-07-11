# Voice chat TURN server (coturn) setup

Voice uses WebRTC peer-to-peer audio. STUN alone only connects players on the
**same LAN**; players on different networks / mobile data / symmetric NAT need a
**TURN relay**. coturn runs as its own Docker container on the Azure VM
(alongside the existing Caddy/travelhub stack, which it does not touch) and the
frontend is pointed at it via env vars.

Files:
- [`deploy/turnserver.conf`](deploy/turnserver.conf) — coturn config template.
- [`deploy/run-coturn.sh`](deploy/run-coturn.sh) — pull & run the container.
- Frontend reads `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`
  (see [`web/.env.example`](web/.env.example)); wiring lives in
  [`web/src/components/VoiceControls.tsx`](web/src/components/VoiceControls.tsx).

Deployed instance (safariyat.live):
- VM public IP `158.158.32.23`, private `172.16.0.4` (Azure 1:1 NAT).
- coturn container `--network host`, plain `turn:` on port `3478`, relay range
  `49160-49200/udp`, realm `safariyat.live`, user `liarbar`.

---

## What runs where

**Frontend** `games.safariyat.live` (Vercel) · **Backend** `liarbar.safariyat.live`
(container `liarbar` → `127.0.0.1:3001`, proxied by Caddy) · **TURN**
`turn:158.158.32.23:3478` (container `coturn`, host network).

## Step 1 — Open the firewall

**Azure NSG** (Portal → VM → Networking), inbound, Source `Any`, Allow:

| Protocol | Port range  |
| -------- | ----------- |
| UDP      | 3478        |
| TCP      | 3478        |
| UDP      | 49160-49200 |

**Host ufw** (already applied on the deployed VM):
```bash
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 49160:49200/udp
```

## Step 2 — Config + run the container

Fill the placeholders in [`deploy/turnserver.conf`](deploy/turnserver.conf)
(`external-ip`, `realm`, `user=NAME:PASSWORD`) and install it to
`/etc/turnserver.conf` on the VM. The password is a secret — set it only on the
VM and in Vercel, never commit it. Then:

```bash
docker run -d --name coturn --restart unless-stopped --network host \
  -v /etc/turnserver.conf:/etc/turnserver.conf:ro coturn/coturn
```

(or run [`deploy/run-coturn.sh`](deploy/run-coturn.sh)).

## Step 3 — Verify

On the VM: `sudo ss -lunp | grep 3478` should show `turnserver` listening.

From your laptop, open the
[Trickle-ICE tester](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):
- URI `turn:158.158.32.23:3478`, plus the username / credential.
- **Add server** → **Gather candidates**. ✅ Success = at least one candidate of
  type **`relay`**. No `relay` row means an NSG/`external-ip` problem.

## Step 4 — Point the frontend at it

Vercel → Project → Settings → Environment Variables (Production):
```
VITE_TURN_URL=turn:158.158.32.23:3478
VITE_TURN_USERNAME=liarbar
VITE_TURN_CREDENTIAL=<the password set on the VM>
```
Redeploy. Retest voice with one device on **mobile data** — it should connect
across networks now.

---

## Notes

- **Plain `turn:` from an HTTPS page is allowed** — browsers don't treat it as
  mixed content, so no TLS/cert is required, and it avoids fighting Caddy over
  port 443. Enable `turns:` (5349) later for restrictive networks (needs a cert).
- **Credentials are visible to the client** by design — the user/pass ships in
  the frontend bundle. Acceptable for a casual game. To harden, switch to
  coturn `static-auth-secret` + short-lived REST credentials minted by the
  backend.
- coturn is idle-cheap; it only relays bandwidth when a direct P2P path can't be
  found.
