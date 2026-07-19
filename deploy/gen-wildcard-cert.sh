#!/usr/bin/env bash
# Génère un certificat self-signed WILDCARD pour Transpo :
#   transpo.wedo.technology  +  *.transpo.wedo.technology  (sous-domaines tenant)
# Produit fullchain.pem + key.pem (à charger dans Dokku via `dokku certs:add`).
set -euo pipefail

BASE_DOMAIN="${1:-transpo.wedo.technology}"
OUT="${2:-./certs}"
mkdir -p "$OUT"

openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "$OUT/key.pem" \
  -out "$OUT/fullchain.pem" \
  -subj "/C=MA/O=Transpo/CN=$BASE_DOMAIN" \
  -addext "subjectAltName=DNS:$BASE_DOMAIN,DNS:*.$BASE_DOMAIN"

echo "Certificat self-signed généré dans $OUT :"
echo "  - $OUT/fullchain.pem  (couvre $BASE_DOMAIN et *.$BASE_DOMAIN)"
echo "  - $OUT/key.pem"
echo
echo "Chargement dans Dokku (sur l'hôte) :"
echo "  tar -cf /tmp/certs.tar -C $OUT fullchain.pem key.pem"
echo "  dokku certs:add transpo-web < /tmp/certs.tar"
