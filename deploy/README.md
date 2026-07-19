# Déploiement Transpo — Scaleway + Dokku

Déploiement de la plateforme (API NestJS + Console Next.js + PostgreSQL) sur un
VM **Scaleway** avec **Dokku**, domaine `transpo.wedo.technology` et
sous-domaines tenant `*.transpo.wedo.technology`, **SSL self-signed** (wildcard).

## Architecture
| App Dokku | Rôle | Domaine |
|---|---|---|
| `transpo-db` | PostgreSQL (plugin dokku-postgres) → `DATABASE_URL` | interne |
| `transpo-api` | API NestJS (port 3000) | interne (réseau `transpo-net`) |
| `transpo-web` | Console Next.js (port 3001) | `transpo.wedo.technology` + `*.transpo.wedo.technology` |

La console appelle l'API via le réseau interne Dokku (`http://transpo-api.web:3000`).
Le **tenant est résolu par le sous-domaine** (`casaexpress.transpo.wedo.technology` → tenant `casaexpress`).

## Étapes

### 1. Provisionner le VM (Dokku auto-installé)
```bash
export SCW_ACCESS_KEY=...  SCW_SECRET_KEY=...  SCW_DEFAULT_PROJECT_ID=6d465153-d072-477a-9799-d930b6ba977c
./deploy/provision-scaleway.sh          # crée le VM, affiche l'IP publique
```
Attendre ~5 min (cloud-init installe Docker + Dokku + plugin postgres + swap).
Vérifier : `ssh root@<IP> 'cat /root/.dokku-ready'`.

### 2. DNS (chez le registrar de wedo.technology — accès requis)
```
A   transpo.wedo.technology     ->  <IP>
A   *.transpo.wedo.technology   ->  <IP>
```

### 3. Créer les apps sur le VM
```bash
scp deploy/setup-dokku.sh root@<IP>:/root/
ssh root@<IP> 'BASE_DOMAIN=transpo.wedo.technology bash /root/setup-dokku.sh <JWT_SECRET>'
```

### 4. Déployer le code (depuis ce dépôt)
```bash
git remote add dokku-api dokku@<IP>:transpo-api && git push dokku-api main
git remote add dokku-web dokku@<IP>:transpo-web && git push dokku-web main
```

### 5. Migrations + seed
```bash
ssh root@<IP> "dokku run transpo-api sh -c 'cd /repo && pnpm --filter @transpo/db migrate && pnpm --filter @transpo/db seed'"
```

### 6. SSL self-signed wildcard
```bash
ssh root@<IP> 'cd /repo && ./deploy/gen-wildcard-cert.sh transpo.wedo.technology /tmp/certs \
  && tar -cf /tmp/certs.tar -C /tmp/certs fullchain.pem key.pem \
  && dokku certs:add transpo-web < /tmp/certs.tar'
```

Accès : `https://casaexpress.transpo.wedo.technology` (certificat self-signed → avertissement navigateur attendu).

## Sécurité
- Ne **jamais** committer les clés Scaleway / le `JWT_SECRET` / les certificats.
- Régénérer les clés API partagées en clair après usage.
