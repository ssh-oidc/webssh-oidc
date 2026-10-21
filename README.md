# Developing

Requires Node.js 22.12 or newer. Install dependencies with `npm install`, then start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Run express app

```bash
npm run start
```

## Build and run docker image

After building the app, you can build the docker image:

```bash
docker build -t webssh-oidc .
```

To run the docker image, you first need to configure the environment variables.

```bash
cp .env.example .env
```

Then create OIDC clients with the providers you want to use and add them to the yml config file in `config` (see [config/default.yml.example](config/default.yml.example) for an example configuration). If you're running the app locally or without tls, name the file `config/development.yml` and set `NODE_ENV=development` in the `.env` file. In production, the file should be named `config/production.yml` and NODE_ENV should be set to `production`.

The redirect URI should be `http://localhost:8444/auth/callback/{provider_id}`, where `{provider_id}` is the id of the OIDC provider.

List of supported providers and their corresponding ids:

- `google` for `https://accounts.google.com`
- `egi` for `https://aai.egi.eu/auth/realms/egi`
- `egi-dev` for `https://aai-dev.egi.eu/auth/realms/egi`
- `wlcg` for `https://wlcg.cloud.cnaf.infn.it`
- `helmholtz` for `https://login.helmholtz.de/oauth2`
- `helmholtz-dev` for `https://login-dev.helmholtz.de/oauth2`
- `deep-hdc` for `https://iam.deep-hybrid-datacloud.eu`
- `kit` for `https://oidc.scc.kit.edu/auth/realms/kit`
- `eduteams` for `https://proxy.eduteams.org`
- `didmos` for `https://auth.didmos.nfdi-aai.de`
- `fels` for https://fels.scc.kit.edu/oidc/realms/fels`
- `myaccessid` for `https://proxy.myaccessid.org`

<!-- https://keycloak.sso.gwdg.de/auth/realms/academiccloud -->
<!-- https://login.aai.lifescience-ri.eu/oidc -->

You can then run the full stack (app + motley-cue + Caddy) with:

```bash
docker compose -f docker/compose.yaml up -d --build
```

Or run only the infrastructure in Docker and the app on the host with
`npm run dev` — see [docker/README.md](docker/README.md) for both workflows,
remote-VM deployment, and troubleshooting. `docker/` bundles the motley-cue
image (motley-cue API + sshd + PAM) and the Caddy configuration, so no
separate repository/compose file is needed.

If you're not using TLS (not recommended, only do this when you're running the code locally), set `NODE_ENV=development` in the `.env` file.

## Configuration

OIDC clients (id + secret) can be configured in `config/default.yml`. An example can be found in `config/default.yml.example`.

A privacy policy is necessary to be able to run the app. The compose file assumes one is present in `config/docs/privacy.md`. An example can be found in `config/docs/privacy.md.example`.

## Contributing

To increase version number, please do not tag the commit. Instead, use:

```bash
npm version [ patch | minor | major ] --no-git-tag-version
```
