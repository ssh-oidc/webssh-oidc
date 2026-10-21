# Installation notes
(on debian/trixie)

1. Install docker-ce and npm
    create/etc/apt/sources.list.d/docker-ce.sources 
    ```
    Types: deb
    URIs: http://download.docker.com/linux/debian/
    Suites: buster
    Components: stable
    Signed-By: /etc/apt/trusted.gpg.d/download.docker.com.asc
    ```
    ```curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/trusted.gpg.d/download.docker.com.gpg```


    Then:
    ```
    apt install npm docker-ce
    ```

1. Test docker networking
    ```docker run --rm alpine nslookup registry.npmjs.org```

1. Configure docker: `/etc/c/docker/daemon.json `
    ```
    {
        "bip": "10.200.0.1/24",
        "default-address-pools": [
            {"base": "10.201.0.0/16","size":24},
            {"base": "10.202.0.0/16","size":24}
        ],
        "log-driver":"local",
        "log-opts":{"max-size":"10m","max-file":"3"}
    }
    ```

Also add your webssh user to the `docker` group

1. Install dependencies:
    ```
    npm install --legacy-peer-deps

    # Note: The --legacy-peer-deps parameter is needed because of version
    # mismatches between Vite 5/Svelte 4 and some dependencies that expect
    # newer versions.
    ```

1. Build:
    ```
    npm run buid
    ```

1. As user build the container:
    - With debug logs (in the web-browser)
    ```
    docker build --build-arg VITE_LOG_LEVEL=debug -t marcvs/webssh-oidc-dev .
    ```
    - Without debug logs:
    ```
    docker build -t marcvs/webssh-oidc .
    ```

1. Maybe push the container:
   ```
   docker push marcvs/webssh-oidc
   ```

1. Configure using:
    - `.env`
    - `config/default.yml*`


## Motley cue

Following instructions on <https://github.com/dianagudu/motley_cue_docker>

One  will have to install certificates:
```
docker run --rm --publish 80:80 --publish 443:443 -it certbot/certbot:latest certonly
```


add clients for:
- didmos
    https://auth.didmos.nfdi-aai.de
- academicID
    https://keycloak.sso.gwdg.de/auth/realms/academiccloud
- regapp
    https://regapp.nfdi-aai.de/oidc/realms/nfdi
- unity
    https://login.helmholtz.de/oauth2
    https://login.helmholtz.de/punch-oauth2
- infraproxy
    https://infraproxy.nfdi-aai.dfn.de
- edu-id:
    https://proxy.edu-id.dfn.de
