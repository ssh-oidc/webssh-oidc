#!/bin/sh
# One-shot helper for docker/compose-oinit.yaml. Run inside the motley_cue
# appliance container (mounts: ca_state at /ca, read-only; motley_cue_state
# at /state, read-write):
#
#   docker compose -f docker/compose-oinit.yaml run --rm \
#       --entrypoint sh motley-cue /oinit-signup.sh
#
# It seeds the account database, creates the SSH host key, signs it with the
# CA and installs the host certificate + user CA public key where the
# appliance expects them. Start the oinit-ca service first so that the CA
# keys exist.
set -eu

# "docker compose run" does not execute the appliance entrypoint (which
# seeds the account database), but ssh-keygen needs /etc/passwd to resolve
# uid 0. Seed the persistent account database from the image templates.
mkdir -p /state/etc
for f in passwd group shadow gshadow subuid subgid; do
    template="/usr/share/motley-cue/state-templates/$f"
    if [ -e "$template" ] && [ ! -e "/state/etc/$f" ]; then
        cp -a "$template" "/state/etc/$f"
    fi
done

mkdir -p /state/ssh /state/ssh/oinit

# The appliance generates /state/ssh/ssh_host_ed25519_key on its own start;
# create it here as well so the certificate can be prepared beforehand.
if [ ! -f /state/ssh/ssh_host_ed25519_key ]; then
    ssh-keygen -q -t ed25519 -N '' \
        -f /state/ssh/ssh_host_ed25519_key \
        -C 'webssh-oidc appliance' >/dev/null
fi

# Sign a copy: ssh-keygen writes <name>-cert.pub next to the input file and
# /state may be read-only in other setups.
cp /state/ssh/ssh_host_ed25519_key.pub /tmp/host-key.pub
# Principals: the internal compose name (dialed by webssh) and the published
# host name(s) used by CLI logins. Set OINIT_SSH_HOSTS in docker/.env to add
# the public host name, e.g. "motley-cue,localhost,ssh.example.org".
ssh-keygen -q -s /ca/host-ca -I webssh-oidc-host -h -n "${OINIT_SSH_HOSTS:-motley-cue,localhost}" \
    /tmp/host-key.pub
cp /tmp/host-key-cert.pub /state/ssh/oinit/host-key-cert.pub

cp /ca/user-ca.pub /state/ssh/oinit/user-ca.pub
chmod 0644 /state/ssh/oinit/*

echo "Host key signed and CA assets installed in /state/ssh/oinit."
