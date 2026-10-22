# webssh-oidc + motley-cue stack

One Compose stack that runs everything needed for webssh-oidc locally:

| Service      | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| `caddy`      | TLS frontend: app, motley-cue API (browser), plain-HTTP API (server) |
| `motley-cue` | motley-cue API + sshd + PAM (`pam_ssh_oidc`), published on `:1022`   |
| `webssh`     | webssh-oidc (Node/SvelteKit + WebSocket SSH bridge) on `:8444`       |

The same stack supports two development modes:

1. **Everything in Docker** – `webssh` runs as a container.
2. **Hybrid** – Caddy + motley-cue in Docker, the app on the host via
   `npm run dev` (fast reloads).

---

## Layout

```
docker/
  compose.yaml          # full stack
  compose.dev.yaml      # override: Caddy proxies to the host (npm run dev)
  Caddyfile             # TLS + routing; hostnames overridable via env
  motley-cue/
    Dockerfile          # motley-cue + sshd + PAM image (Debian/KIT repo)
    entrypoint.sh       # seeds /config_files on first start
    runner.sh           # starts motley-cue + sshd
    config/
      motley_cue.conf   # OPs, scopes, user mapping, OTP storage
      feudal_adapter.conf # local linux user backend, shells, groups
```

Everything else (`.env`, `config/development.yml`, app sources) stays in the
repository root.

---

## Prerequisites

- Docker with the Compose plugin.
- Ports `80`, `443`, `8444` and `1022` free on the host.
- For the optional HTTPS hostnames, add to `/etc/hosts`:

  ```
  127.0.0.1 motley-cue.localhost webssh-oidc.localhost
  ```

  The default local configuration does **not** need these entries: the app is
  used at `http://localhost:8444` and motley-cue at
  `http://localhost/motley_cue/`, both plain HTTP on localhost.

- The Caddy local CA only has to be trusted if you use the HTTPS hostnames
  (`https://motley-cue.localhost`, `https://webssh-oidc.localhost`).
  That is optional locally — see
  [Untrusted CA](#troubleshooting). If the `caddy_data` volume is deleted,
  the CA is regenerated.

- Create the environment file and, at minimum, set `AUTH_SECRET`:

  ```bash
  cp .env.example .env
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" .env
  ```

- Configure the OIDC providers (client IDs/secrets) in
  `config/development.yml` (used when `NODE_ENV=development`) or
  `config/production.yml`. The callback URL for a provider is
  `http://localhost:8444/auth/callback/<provider-id>`
  (e.g. `.../auth/callback/egi-dev`); register it with each OP.

---

## Mode 1: everything in Docker

From the repository root:

```bash
docker compose -f docker/compose.yaml pull webssh
docker compose -f docker/compose.yaml up -d
```

The `webssh` image is pulled from `sshoidc/webssh-oidc`. The default tag is
`latest`; use `WEBSSH_TAG=prerel` for the prerelease image or a version such
as `WEBSSH_TAG=0.5.0` for a release. The `motley-cue` image is built locally
from `docker/motley-cue`.

- App: <http://localhost:8444>
- motley-cue API (browser, plain HTTP, CORS enabled):
  <http://localhost/motley_cue/>
- HTTPS hostnames (optional, needs the Caddy CA): <https://motley-cue.localhost>
  and <https://webssh-oidc.localhost>
- SSH: `ssh -p 1022 <motley-cue-user>@localhost`

Notes:

- `webssh` reads the repository-root `.env`; container-internal values
  (`INTERNAL_MC_ENDPOINT=http://caddy/motley_cue/`,
  `SSH_INTERNAL_HOSTNAME=motley-cue`, `SSH_PORT=22`) are overridden in
  `docker/compose.yaml`.
- The default `MC_ENDPOINT=http://localhost/motley_cue/` is served by Caddy's
  plain-HTTP listener with CORS headers, so the browser does not need to trust
  the Caddy CA. It only works while the app itself is opened over HTTP
  (`http://localhost:8444`); an HTTPS app cannot call an HTTP endpoint
  (mixed content). Switch to `https://motley-cue.localhost/` after trusting
  the CA, or use an HTTPS URL in production.
- Use `http://localhost:8444` (the registered OAuth redirect base). If you
  browse through `https://webssh-oidc.localhost`, the redirect URI changes
  and must be registered as well; set `AUTH_URL` accordingly.
- To update the app image:

  ```bash
  docker compose -f docker/compose.yaml pull webssh
  docker compose -f docker/compose.yaml up -d --no-deps webssh
  ```

---

## Mode 2: app on the host (`npm run dev`)

Start only the infrastructure:

```bash
docker compose -f docker/compose.yaml -f docker/compose.dev.yaml up -d caddy motley-cue
```

`compose.dev.yaml` makes Caddy proxy `webssh-oidc.localhost` to
`host.docker.internal:8444` instead of the `webssh` container.

Then, in the repository root (one terminal):

```bash
npm install              # once
npm run dev              # SvelteKit + SSH/WebSocket bridge on :8444
```

Open <http://localhost:8444>.

The SSH/WebSocket bridge is attached to Vite's HTTP server by the `ws-bridge`
plugin in `vite.config.ts`, so no separate `dev:ws` process or port is needed.
In production `server.js` mounts the same handler from `ws-bridge.js` on
Express.

Vite binds to all interfaces (`server.host` in `vite.config.ts`) so Caddy can
reach the dev server through the Docker host gateway. If you do not need the
Caddy frontend while developing, you can also open `http://localhost:8444`
directly.

The root `.env` is written for this mode: Caddy publishes plain HTTP on
`:80`, so the server-side motley-cue endpoint is
`INTERNAL_MC_ENDPOINT=http://localhost/motley_cue/`, the browser-side one is
`MC_ENDPOINT=http://localhost/motley_cue/` (no CA trust required), and sshd
is dialed at `localhost:1022`.

---

## Running on a remote VM

The stack is hostname-parameterized. For a public VM:

1. **DNS**: point `webssh.example.org` (app) and optionally
   `motley-cue.example.org` (API) at the VM.

2. **Caddy hostnames**: create `docker/.env` (Compose reads it for variable
   substitution; this is separate from the repo-root `.env`):

   ```dotenv
   WEBSSH_HOST=webssh.example.org
   MC_HOST=motley-cue.example.org
   ```

3. **TLS**: in `docker/Caddyfile`, delete the two `tls internal` lines.
   With the public hostnames above, Caddy obtains Let's Encrypt
   certificates automatically (ports 80/443 must be reachable). Keep
   `tls internal` only if clients can trust your local CA.

4. **App URL** in the repo-root `.env`:

   ```dotenv
   ORIGIN=https://webssh.example.org
   AUTH_URL=https://webssh.example.org
   MC_ENDPOINT=https://motley-cue.example.org/
   ```

5. **OAuth clients**: register
   `https://webssh.example.org/auth/callback/<provider-id>` at every OP and
   put the corresponding client IDs/secrets in `config/production.yml`
   (`NODE_ENV=production`). Auth.js then uses secure cookies, so the app
   must be served over HTTPS (through Caddy).

6. **Firewall**: expose `80/tcp` and `443/tcp`. Only `caddy` needs to be
   public; to stop publishing the app port, change the `webssh` port mapping
   to `127.0.0.1:8444:8444` (Caddy still reaches it over the Compose
   network). Publish `1022/tcp` only if users should SSH directly.

7. Start it:

   ```bash
   docker compose -f docker/compose.yaml pull webssh
   docker compose -f docker/compose.yaml up -d
   ```

   Set `WEBSSH_TAG` to `prerel` or a release version if you do not want
   `latest`.

   The SSH command shown in the UI uses `SSH_HOSTNAME`/`SSH_PORT`; for
   remote access set e.g. `SSH_HOSTNAME=ssh.example.org` and
   `SSH_PORT=1022` in the root `.env` (the container still dials
   `motley-cue:22`).

---

## Configuration reference

Repo-root `.env` (shared by host dev and the container):

| Variable                | Meaning                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`           | Auth.js session encryption secret                                                                          |
| `ORIGIN` / `AUTH_URL`   | Public URL of the app (`AUTH_URL` needed behind a proxy)                                                   |
| `MC_ENDPOINT`           | motley-cue URL used by the **browser** (local default: `http://localhost/motley_cue/`, no CA trust needed) |
| `INTERNAL_MC_ENDPOINT`  | motley-cue URL used **server-side** (host dev mode)                                                        |
| `SSH_HOSTNAME`          | Host shown in the SSH command                                                                              |
| `SSH_INTERNAL_HOSTNAME` | Host the app dials (host dev: `localhost`)                                                                 |
| `SSH_PORT`              | SSH port the app dials / shows (host dev: `1022`)                                                          |
| `SSH_METHOD`            | `mccli` (default) or `oinit`                                                                               |
| `NODE_ENV`              | `development` picks `config/development.yml`; use `production` with HTTPS                                  |
| `LOG_LEVEL`             | `debug` prints tokens — use `info` outside development                                                     |

motley-cue (`docker/motley-cue/config/motley_cue.conf`):

- One `[authorisation.<name>]` section per OP: `op_url` and `scopes`.
- `scopes` must be requestable by the OAuth client; otherwise the OP returns
  `error=invalid_scope`. The app requests exactly the scopes reported by
  motley-cue at `/info/op`.
- `authorise_all = True` allows every user of that OP (`egi-dev`/`egi-demo`);
  `authorised_vos`/`authorised_users` restrict access. With the
  `entitlements` scope, set `vo_claim = entitlements` as well.
- OTP state lives in the `motley_cue_cache`/`motley_cue_lib` volumes
  (`/var/cache/motley_cue`, `/var/lib/motley_cue`).

---

## Troubleshooting

- **`/etc/hosts` missing** → only affects the optional HTTPS hostnames
  (`https://motley-cue.localhost`, `https://webssh-oidc.localhost`) and
  therefore Caddy's healthcheck. The default local setup
  (`http://localhost:8444` + `http://localhost/motley_cue/`) does not need
  the `/etc/hosts` entries, but add them if Caddy reports unhealthy or you
  want the HTTPS hostnames.
- **Untrusted CA** → `NET::ERR_CERT_AUTHORITY_INVALID` /
  `Failed to fetch` when `MC_ENDPOINT=https://motley-cue.localhost/`.
  The default local `MC_ENDPOINT=http://localhost/motley_cue/` avoids this
  entirely. To keep using HTTPS, export and trust the current CA (it is
  regenerated whenever the `caddy_data` volume is recreated):

  ```bash
  docker compose -f docker/compose.yaml exec caddy \
    cat /data/caddy/pki/authorities/local/root.crt > caddy-local-ca.crt

  # Chromium/Chrome (close the browser first)
  certutil -d sql:$HOME/.pki/nssdb -A -t "C,," \
    -n "Caddy Local CA (webssh-oidc)" -i caddy-local-ca.crt

  # System-wide (Arch, affects curl and system browsers; needs sudo)
  sudo trust anchor caddy-local-ca.crt
  ```

  Firefox: Settings → Privacy & Security → Certificates → View Certificates →
  Authorities → Import, and enable "Trust this CA to identify websites".
  Every new `caddy_data` volume generates a new root, so re-import after
  deleting the volume.

- **`Failed to fetch` while the app is served over HTTPS** → mixed content:
  an HTTPS page cannot call `http://localhost/motley_cue/`. Set
  `MC_ENDPOINT` to the HTTPS API URL (and trust/replace the CA, or use a
  real certificate).
- **Port already in use** → an old stack is still running. Stop it
  (`docker compose down` in the old project directory) before starting this
  one.
- **`invalid_scope` at login** → the OP rejected the scopes from
  motley-cue's `/info/op`; align `scopes` in `motley_cue.conf` with what the
  OAuth client is allowed to request.
- **SSH connection hangs ~20 s** → PAM cannot reach motley-cue. The image's
  `/etc/pam.d/pam-ssh-oidc-config.ini` verifies via
  `http://mc_endpoint:8080/verify_user`; this stack provides that name as a
  Caddy network alias. Check `docker compose logs caddy motley-cue`.
- **Container DNS** → if the host's resolver is unreachable from Docker
  (VPN/split-horizon setups), add `dns:` entries to the `webssh` service.
- **Logs**:

  ```bash
  docker compose -f docker/compose.yaml logs -f webssh
  docker compose -f docker/compose.yaml logs -f motley-cue
  docker compose -f docker/compose.yaml logs -f caddy
  ```
