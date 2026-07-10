# Deploying the backend to DigitalOcean

Two supported paths. **App Platform is the recommended one** — no server
administration, automatic HTTPS, deploy on every push.

Either way, remember: **run exactly 1 instance.** Room state lives in the
process's memory; a second instance would not see rooms created on the first.

---

## Option A — App Platform (recommended, ~5 minutes)

1. Push your branch to GitHub (already done).
2. In the DigitalOcean dashboard: **Apps → Create App → GitHub**, pick the
   `LiarBar` repo and branch, and set **Source Directory** to `server/`.
   Alternatively import the ready-made spec: [.do/app.yaml](.do/app.yaml)
   (or `doctl apps create --spec .do/app.yaml` with the CLI).
3. Confirm the detected commands:
   - Build: `npm ci && npm run build`
   - Run: `npm start`
   - HTTP port: `3001`
   - Health check path: `/api/health`
4. Set environment variables:
   - `PORT=3001`
   - `ALLOWED_ORIGINS=https://<your-frontend-domain>` (comma-separated if several;
     e.g. `https://liar-bar.vercel.app`)
5. Choose the smallest instance (Basic, 512 MB is plenty to start), **1 instance**, deploy.
6. You get a URL like `https://liarbar-server-xxxxx.ondigitalocean.app`.
   Check `https://<app-url>/api/health` returns `{"status":"ok",...}`.
7. Point the frontend at it: in Vercel (or `web/.env`), set
   `VITE_BACKEND_URL=https://<app-url>` and redeploy the frontend.

App Platform supports WebSockets natively — no extra config needed. HTTPS is
automatic, which also fixes the mixed-content problem of calling an `http://`
backend from an `https://` frontend.

**Cost:** Basic plan starts around $5/mo.

---

## Option B — Droplet (a VM you manage)

More work, but cheapest at ~$4–6/mo and gives you SSH access.

1. Create an Ubuntu 24.04 droplet, add your SSH key.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Clone and run:

   ```bash
   git clone https://github.com/AbdelrahmanMohmmed/LiarBar.git
   cd LiarBar/server
   docker build -t liarbar-server .
   docker run -d --name liarbar --restart unless-stopped \
     -p 3001:3001 \
     -e ALLOWED_ORIGINS=https://<your-frontend-domain> \
     liarbar-server
   ```

4. **Add HTTPS** (required if the frontend is served over HTTPS — browsers
   block insecure WebSocket connections from secure pages). Easiest is a
   [Caddy](https://caddyserver.com) reverse proxy on the same droplet:

   ```bash
   sudo apt install -y caddy
   ```

   `/etc/caddy/Caddyfile` (point a DNS A record, e.g. `api.yourdomain.com`, at the droplet first):

   ```
   api.yourdomain.com {
       reverse_proxy localhost:3001
   }
   ```

   `sudo systemctl reload caddy` — Caddy fetches the TLS certificate
   automatically and proxies WebSockets out of the box.

5. Open the firewall: `sudo ufw allow 80,443/tcp` (and close 3001 to the
   outside: only Caddy should reach it).
6. Set `VITE_BACKEND_URL=https://api.yourdomain.com` in the frontend.

To update after a push: `git pull && docker build -t liarbar-server . && docker restart liarbar`
(or set up a small deploy script / GitHub Action later).

---

## Checklist after deploying (either option)

- [ ] `https://<backend>/api/health` returns `{"status":"ok"}`
- [ ] `ALLOWED_ORIGINS` contains the exact frontend origin (scheme + host, no trailing slash)
- [ ] Frontend `VITE_BACKEND_URL` points at the HTTPS backend URL
- [ ] Create a room from two devices and play a round
