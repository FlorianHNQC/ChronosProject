#!/usr/bin/env bash
#
# Déploiement / mise à jour de Chronos.
# À lancer depuis n'importe où : bash scripts/deploy.sh
#
# Suppose que le provisionnement initial a été fait (scripts/setup.sh), que le
# fichier .env existe à la racine et que PostgreSQL tourne.
#
set -euo pipefail

# Se placer à la racine du dépôt.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

[ -f .env ] || fail "Fichier .env manquant à la racine (voir DEPLOYMENT.md / scripts/setup.sh)."
command -v pm2 >/dev/null 2>&1 || fail "PM2 non installé (npm install -g pm2)."

log "Mise à jour du code (git pull)"
git pull --ff-only

log "Installation des dépendances (npm ci)"
npm ci

log "Synchronisation du schéma (db:push)"
npm run db:push

log "Build de production (client + serveur)"
npm run build

log "(Re)démarrage via PM2"
if pm2 describe chronos >/dev/null 2>&1; then
  pm2 restart chronos --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

log "Terminé. Suivi : pm2 logs chronos"
