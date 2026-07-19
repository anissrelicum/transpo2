#!/usr/bin/env bash
# Provisionne un VM Scaleway (Ubuntu 22.04) avec Dokku auto-installé (cloud-init).
# Prérequis : SCW_ACCESS_KEY, SCW_SECRET_KEY, SCW_DEFAULT_PROJECT_ID en env.
# Une clé SSH publique (~/.ssh/id_ed25519.pub ou $SSH_PUBKEY) est injectée.
set -euo pipefail

ZONE="${ZONE:-fr-par-1}"
TYPE="${TYPE:-DEV1-M}"                 # 3 vCPU / 4 Go (+2 Go swap via cloud-init)
IMAGE="${IMAGE:-ubuntu_jammy}"
NAME="${NAME:-transpo-dokku}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# 1) Clé SSH enregistrée dans Scaleway (pour accès root au VM).
PUB="${SSH_PUBKEY:-$HOME/.ssh/id_ed25519.pub}"
if [ -f "$PUB" ]; then
  scw iam ssh-key create name="transpo-deploy" public-key="$(cat "$PUB")" 2>/dev/null || true
fi

# 2) Création de l'instance avec cloud-init (installe Dokku).
scw instance server create \
  zone="$ZONE" type="$TYPE" image="$IMAGE" name="$NAME" \
  ip=new root-volume=block:20GB \
  cloud-init=@"$HERE/cloud-init.yaml" \
  -o json > /tmp/transpo-server.json

IP=$(node -e "console.log(require('/tmp/transpo-server.json').public_ip.address)" 2>/dev/null || true)
echo "Instance créée. IP publique : $IP"
echo "Dokku s'installe en arrière-plan (~5 min). Vérifier : ssh root@$IP 'cat /root/.dokku-ready'"
echo
echo "DNS à créer chez votre registrar (wedo.technology) :"
echo "  A   transpo.wedo.technology     -> $IP"
echo "  A   *.transpo.wedo.technology   -> $IP   (sous-domaines tenant)"
