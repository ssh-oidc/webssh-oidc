# webssh-oidc + motley-cue stack

Two Compose variants run the full stack:

| Variant | Compose file | SSH login | motley_cue service |
| ------- | ------------ | --------- | ------------------ |
| PAM     | `docker/compose-pam.yaml`    | `pam_ssh_oidc` token login      | `sshoidc/motley-cue-allinone:<version>-pam`    |
| oinit   | `docker/compose-oinit.yaml`  | oinit SSH certificates          | `sshoidc/motley-cue-allinone:<version>-oinit`  |

Both use the official all-in-one motley_cue appliance image (motley_cue API +
`local_unix` account provisioning + sshd in one container) and add:

| Service | Purpose |
| ------- | ------- |
| `caddy`     | TLS frontend: app, motley_cue API, and (oinit variant) the oinit CA |
| `webssh`    | webssh-oidc (Node/SvelteKit + WebSocket SSH bridge) on `:8444` |
| `oinit-ca`  | oinit certificate authority (oinit variant only) |

Both variants support the same two development modes:

1. **Everything in Docker** – `webssh` runs as a container.
2. **Hybrid** – Caddy + motley-cue (and the CA) in Docker, the app on the
   host via `npm run dev` (fast reloads).

The variants cannot run at the same time (they publish the same ports).

---

## Layout

```
docker/
  compose-pam.yaml      # full stack, PAM token login
  compose-oinit.yaml    # full stack, oinit certificate login
  compose.prod.yaml     # override: public host (loopback app/CA ports)
  compose.dev.yaml      # override: Caddy proxies to the host (npm run dev)
  Caddyfile             # TLS + routing; hostnames overridable via env
  Caddyfile.prod        # same, without tls internal (public ACME certs)
  motley-cue-config/
    motley_cue.conf     # OPs, scopes, user mapping, OTP storage
    feudal_adapter.conf # local_unix backend, shells, groups
  oinit-ca.ini          # oinit CA config (oinit variant)
  oinit-signup.sh       # one-shot host-key signing helper (oinit variant)
```

Everything else (`.env`, `config/development.yml`, app sources) stays in the
repository root.

---

## Prerequisites

- Docker with the Compose plugin.
- Ports `80`, `443`, `8444` and `1022` free on the host (`8082` as well for
  the oinit variant).
- For the optional HTTPS hostnames, add to `/etc/hosts`:

  ```
  127.0.0.1 motley-cue.localhost webssh-oidc.localhost oinit-ca.localhost
  ```

  The default local configuration does **not** need these entries: the app is
  used at `http://localhost:8444` and motley-cue at
  `http://localhost/motley_cue/`, both plain HTTP on localhost.

- The Caddy local CA only has to be trusted if you use the HTTPS hostnames
  (`https://motley-cue.localhost`, `https://webssh-oidc.localhost`,
  `https://oinit-ca.localhost`). That is optional locally — see
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

The `webssh` image is pulled from `sshoidc/webssh-oidc` (default tag
`latest`; use `WEBSSH_TAG=prerel` for the prerelease image or a version such
as `WEBSSH_TAG=0.2.4` for a release). The motley_cue appliance image is
pulled from `sshoidc/motley-cue-allinone`; select its version with `MC_TAG`
(default `0.8.9`).

### PAM variant

From the repository root:

```bash
docker compose -f docker/compose-pam.yaml pull
docker compose -f docker/compose-pam.yaml up -d
```

- App: <http://localhost:8444>
- motley-cue API (browser/client tools, plain HTTP, CORS enabled):
  <http://localhost/motley_cue/>
- HTTPS hostnames (optional, needs the Caddy CA):
  <https://motley-cue.localhost> and <https://webssh-oidc.localhost>
- SSH: `ssh -p 1022 <motley-cue-user>@localhost`

### oinit variant

```bash
# 1. Start the CA first: it generates the SSH CA key pairs on first start.
docker compose -f docker/compose-oinit.yaml up -d oinit-ca

# 2. Sign the appliance's SSH host key and install the CA assets.
docker compose -f docker/compose-oinit.yaml run --rm \
    --entrypoint sh motley-cue /oinit-signup.sh

# 3. Start the rest. The appliance refuses to start until step 2 is done.
docker compose -f docker/compose-oinit.yaml up -d
```

- App: <http://localhost:8444> (oinit certificate login via the CA)
- motley-cue API: <http://localhost/motley_cue/> (and
  <https://motley-cue.localhost>)
- oinit CA: <http://localhost:8082> and <https://oinit-ca.localhost>
- SSH: `ssh -p 1022 oinit@localhost` after `oinit add -y localhost:1022 http://localhost:8082`

The CA hostgroup in `docker/oinit-ca.ini` resolves two hostnames, both to the
motley_cue appliance: `localhost` (`SSH_HOSTNAME`, used by the browser
session and CLI) and `motley-cue` (`SSH_INTERNAL_HOSTNAME`, dialed by the
`webssh` container).

### Notes for both variants

- `webssh` reads the repository-root `.env`; container-internal values
  (`INTERNAL_MC_ENDPOINT=http://caddy/motley_cue/`,
  `SSH_INTERNAL_HOSTNAME=motley-cue`, `SSH_PORT=22`, and in the oinit
  variant `SSH_METHOD=oinit` + `OINIT_ENDPOINT=http://oinit-ca:8082/oinit/api/v1`)
  are overridden in the Compose files.
- The default `MC_ENDPOINT=http://localhost/motley_cue/` is served by Caddy's
  plain-HTTP listener with CORS headers, so the browser does not need to trust
  the Caddy CA. It only works while the app itself is opened over HTTP
  (`http://localhost:8444`); an HTTPS app cannot call an HTTP endpoint
  (mixed content). Switch to `https://motley-cue.localhost/` after trusting
  the CA, or use an HTTPS URL in production.
- The motley_cue API and (in the oinit variant) the oinit CA have their own
  Caddy hostnames, so CLI tools (`mccli`, `oinit`) can reach them directly.
- Use `http://localhost:8444` (the registered OAuth redirect base). If you
  browse through `https://webssh-oidc.localhost`, the redirect URI changes
  and must be registered as well; set `AUTH_URL` accordingly.
- To update the app image:

  ```bash
  docker compose -f docker/compose-pam.yaml pull webssh
  docker compose -f docker/compose-pam.yaml up -d --no-deps webssh
  ```

---

## Mode 2: app on the host (`npm run dev`)

Start only the infrastructure (either variant):

```bash
docker compose -f docker/compose-pam.yaml -f docker/compose.dev.yaml up -d caddy motley-cue
# or:
docker compose -f docker/compose-oinit.yaml -f docker/compose.dev.yaml up -d caddy motley-cue oinit-ca
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
is dialed at `localhost:1022`. For the oinit variant, set
`OINIT_ENDPOINT=http://localhost:8082/oinit/api/v1` in the root `.env`
(the Compose files override this with the in-network URL).

---

## Running on a public host

The reference deployment runs the oinit variant on
`ssh-oidc-cicd.vm.fedcloud.eu` (wildcard DNS), with these hostnames:

| Role | Hostname |
| ---- | -------- |
| App | `webssh.ssh-oidc-cicd.vm.fedcloud.eu` |
| motley-cue API (browser, `mccli`) | `motley-cue.ssh-oidc-cicd.vm.fedcloud.eu` |
| oinit CA API (`oinit` CLI) | `ca.ssh-oidc-cicd.vm.fedcloud.eu` |
| SSH login | `ssh.ssh-oidc-cicd.vm.fedcloud.eu:1022` |

Clients use those Caddy hostnames only; `8082` and `8444` stay bound to
loopback (Docker's published ports bypass host firewalls, so the production
override removes that exposure).

1. **Docker Compose ≥ 2.24** on the host (needed for `!override`).

2. **`docker/.env`** (Compose reads it from the `docker/` directory; separate
   from the repo-root `.env`):

   ```dotenv
   WEBSSH_HOST=webssh.ssh-oidc-cicd.vm.fedcloud.eu
   MC_HOST=motley-cue.ssh-oidc-cicd.vm.fedcloud.eu
   OINIT_CA_HOST=ca.ssh-oidc-cicd.vm.fedcloud.eu
   CADDYFILE=Caddyfile.prod
   OINIT_CA_CONFIG=oinit-ca.prod.ini
   OINIT_SSH_HOSTS=motley-cue,localhost,ssh.ssh-oidc-cicd.vm.fedcloud.eu
   MC_TAG=0.8.9
   OINIT_CA_TAG=1.3.2
   WEBSSH_TAG=0.2.4
   ```

   The CI deploy jobs overwrite these pins with the released versions.

3. **`docker/oinit-ca.prod.ini`** — copy `docker/oinit-ca.ini` and add the
   public SSH hostname (clients ask the CA for a certificate for the name
   shown in the SSH command):

   ```ini
   [webssh]
   motley-cue = http://motley-cue:8080
   localhost = http://motley-cue:8080
   ssh.ssh-oidc-cicd.vm.fedcloud.eu = http://motley-cue:8080
   ```

   Also add the public name to `OINIT_SSH_HOSTS` (above) so the host
   certificate is signed with it as principal.

4. **TLS** is handled by `Caddyfile.prod` (no `tls internal`): Caddy obtains
   Let's Encrypt certificates for the three hostnames automatically. Ports
   80/443 must be reachable.

5. **Repo-root `.env`**:

   ```dotenv
   AUTH_SECRET=<openssl rand -base64 32>
   ORIGIN=https://webssh.ssh-oidc-cicd.vm.fedcloud.eu
   AUTH_URL=https://webssh.ssh-oidc-cicd.vm.fedcloud.eu
   MC_ENDPOINT=https://motley-cue.ssh-oidc-cicd.vm.fedcloud.eu/
   SSH_HOSTNAME=ssh.ssh-oidc-cicd.vm.fedcloud.eu
   SSH_PORT=1022
   NODE_ENV=production
   ```

6. **OAuth clients**: register
   `https://webssh.ssh-oidc-cicd.vm.fedcloud.eu/auth/callback/<provider-id>`
   at every OP and put the client IDs/secrets in `config/production.yml`.
   Put the privacy policy in `config/docs/privacy.md`.

7. **Firewall**: expose `80/tcp`, `443/tcp` and `1022/tcp`. Do not expose
   `8082`, `8080` or `8444`.

8. **Start** (oinit variant, production override):

   ```bash
   COMPOSE='docker compose -f docker/compose-oinit.yaml -f docker/compose.prod.yaml'
   $COMPOSE up -d oinit-ca
   $COMPOSE run --rm --entrypoint sh motley-cue /oinit-signup.sh
   $COMPOSE up -d --wait
   ```

   The three steps are only needed on first start; the CA keys and appliance
   state live in named volumes afterwards.

### Continuous deployment

The GitHub Actions workflows deploy releases onto this host when a
non-prerelease `vX.Y.Z` tag is pushed on the release branch (`main` for
webssh-oidc, `master` for motley_cue and oinit). Pushes to `prerel` only
publish the moving `prerel` images; they do not deploy. Each pipeline SSHes
in, serializes on `/tmp/webssh-oidc-deploy.lock` and restarts only its own
container:

| Repo | Container(s) restarted | Image tag |
| ---- | ---------------------- | --------- |
| `webssh-oidc` | `webssh`, `caddy` | release version, e.g. `0.2.4` |
| `motley_cue` | `motley-cue` (all-in-one appliance) | release version, e.g. `0.8.9-oinit` |
| `oinit` | `oinit-ca` | release version, e.g. `1.3.3` |

The host checkout lives at `/opt/webssh-oidc` and is checked out to the
webssh-oidc release tag by its pipeline, so it is also the deployment
manifest: release and deploy webssh-oidc first if a release changes these
Compose files. The motley_cue and oinit pipelines only update their image
pins (`MC_TAG`, `OINIT_CA_TAG`) in `docker/.env` and run Compose against that
checkout. Files that must survive the checkout (`.env`, `docker/.env`,
`docker/oinit-ca.prod.ini`, `config/production.yml`,
`config/docs/privacy.md`) are gitignored.

---

## Configuration reference

Repo-root `.env` (shared by host dev and the container):

| Variable                | Meaning                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`           | Auth.js session encryption secret                                                                          |
| `ORIGIN` / `AUTH_URL`   | Public URL of the app (`AUTH_URL` needed behind a proxy)                                                   |
| `MC_ENDPOINT`           | motley-cue URL used by the **browser** (local default: `http://localhost/motley_cue/`, no CA trust needed) |
| `INTERNAL_MC_ENDPOINT`  | motley-cue URL used **server-side** (host dev mode)                                                        |
| `SSH_HOSTNAME`          | Host shown in the SSH command and used in the oinit certificate request                                    |
| `SSH_INTERNAL_HOSTNAME` | Host the app dials (host dev: `localhost`)                                                                 |
| `SSH_PORT`              | SSH port the app dials / shows (host dev: `1022`)                                                          |
| `SSH_METHOD`            | `mccli` (default) or `oinit`                                                                               |
| `OINIT_ENDPOINT`        | oinit CA API base URL for `SSH_METHOD=oinit` (host dev: `http://localhost:8082/oinit/api/v1`)               |
| `NODE_ENV`              | `development` picks `config/development.yml`; use `production` with HTTPS                                  |
| `LOG_LEVEL`             | `debug` prints tokens — use `info` outside development                                                     |

`docker/.env` (Compose variable substitution; not passed to the containers):

| Variable           | Meaning                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `WEBSSH_HOST`      | Public app hostname used by Caddy                                                          |
| `MC_HOST`          | Public motley-cue API hostname used by Caddy                                               |
| `OINIT_CA_HOST`    | Public oinit CA hostname used by Caddy                                                     |
| `CADDYFILE`        | Caddyfile to mount (default `Caddyfile`; use `Caddyfile.prod` for public ACME certs)       |
| `OINIT_CA_CONFIG`  | oinit CA config file to mount (default `oinit-ca.ini`)                                     |
| `OINIT_SSH_HOSTS`  | Comma-separated principals for the signed SSH host key (default `motley-cue,localhost`)     |
| `MC_TAG`           | motley_cue appliance image version (default `0.8.9`; pinned to the release by CI)         |
| `OINIT_CA_TAG`     | oinit CA image version (default `latest`; pinned to the release by CI)                    |
| `WEBSSH_TAG`       | webssh-oidc image version (default `latest`; pinned to the release by CI)                 |

motley_cue (`docker/motley-cue-config/motley_cue.conf`):

- One `[authorisation.<name>]` section per OP: `op_url` and `scopes`.
- `scopes` must be requestable by the OAuth client; otherwise the OP returns
  `error=invalid_scope`. The app requests exactly the scopes reported by
  motley-cue at `/info/op`.
- `authorise_all = True` allows every user of that OP (`egi-dev`/`egi-demo`);
  `authorised_vos`/`authorised_users` restrict access. With the
  `entitlements` scope, set `vo_claim = entitlements` as well.
- OTP state and the account database live in the `motley_cue_state` volume
  (`/state`: `motley_cue/tokenmap.db`, `motley_cue/motley_cue.key`, `etc/`,
  `home/`, `ssh/`). Back it up before recreating the container.

---

## Troubleshooting

- **`/etc/hosts` missing** → only affects the optional HTTPS hostnames
  (`https://motley-cue.localhost`, `https://webssh-oidc.localhost`,
  `https://oinit-ca.localhost`) and therefore Caddy's healthcheck. The
  default local setup (`http://localhost:8444` +
  `http://localhost/motley_cue/`) does not need the `/etc/hosts` entries,
  but add them if Caddy reports unhealthy or you want the HTTPS hostnames.
- **Untrusted CA** → `NET::ERR_CERT_AUTHORITY_INVALID` /
  `Failed to fetch` when `MC_ENDPOINT=https://motley-cue.localhost/`.
  The default local `MC_ENDPOINT=http://localhost/motley_cue/` avoids this
  entirely. To keep using HTTPS, export and trust the current CA (it is
  regenerated whenever the `caddy_data` volume is recreated):

  ```bash
  docker compose -f docker/compose-pam.yaml exec caddy \
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
- **oinit variant: appliance restart-loops with
  `oinit is not provisioned`** → run the signing step
  (`run --rm --entrypoint sh motley-cue /oinit-signup.sh`) after the CA has
  started, then `up -d` again.
- **oinit variant: signing step fails with `No such file` for the CA keys**
  → the CA has not started yet (its keys are generated on first start).
  Run `up -d oinit-ca` first and check
  `docker compose -f docker/compose-oinit.yaml logs oinit-ca`.
- **oinit variant: certificate request returns 404** → the hostname used in
  the request is not in the CA config (`docker/oinit-ca.ini`, or the file
  selected by `OINIT_CA_CONFIG`). The app requests a certificate for
  `SSH_HOSTNAME` (default `localhost`), so that name must be a key in the
  `[webssh]` section (in production: the `ssh.` hostname).
- **Port already in use** → the other variant or an old stack is still
  running. Stop it (`docker compose -f <file> down`) before starting this
  one.
- **`invalid_scope` at login** → the OP rejected the scopes from
  motley-cue's `/info/op`; align `scopes` in `motley_cue.conf` with what the
  OAuth client is allowed to request.
- **SSH connection hangs ~20 s** → PAM cannot reach the motley_cue API. In
  the all-in-one appliance the API runs in the same container and is
  verified via `http://127.0.0.1:8080/verify_user`; check
  `docker compose logs motley-cue`.
- **Container DNS** → if the host's resolver is unreachable from Docker
  (VPN/split-horizon setups), add `dns:` entries to the `webssh` service.
- **Logs**:

  ```bash
  docker compose -f docker/compose-pam.yaml logs -f webssh
  docker compose -f docker/compose-pam.yaml logs -f motley-cue
  docker compose -f docker/compose-pam.yaml logs -f caddy
  ```
