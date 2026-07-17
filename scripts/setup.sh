#!/usr/bin/env bash
#
# Provisionnement initial d'un serveur Ubuntu pour Chronos (à lancer UNE fois).
# Installe Node 20, PostgreSQL, Nginx, PM2 ; crée la base et un fichier .env.
#
# Usage (depuis la racine du dépôt) :  sudo bash scripts/setup.sh
#
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
[ "$(id -u)" -eq 0 ] || { echo "Lance ce script avec sudo."; exit 1; }

log "Node 20 LTS"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

log "PostgreSQL + Nginx"
apt-get install -y postgresql nginx

log "PM2"
npm install -g pm2

log "Base de données"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='chronos'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER chronos WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='chronos'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE chronos OWNER chronos;"

log "Fichier .env"
if [ -f .env ]; then
  echo "-> .env déjà présent, on ne le touche pas."
else
  ADMIN_PASS="$(openssl rand -hex 8)"
  cat > .env <<EOF2
DATABASE_URL="postgresql://chronos:${DB_PASS}@127.0.0.1:5432/chronos"
PORT=5000
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@chronos.com
ADMIN_PASSWORD=${ADMIN_PASS}
BRAWLSTARS_API_TOKEN=
EOF2
  chmod 600 .env
  echo "-> .env créé."
  echo "   ADMIN_EMAIL    = admin@chronos.com"
  echo "   ADMIN_PASSWORD = ${ADMIN_PASS}   (note-le, puis change-le)"
  echo "   Complète BRAWLSTARS_API_TOKEN (IP du VPS autorisée sur le token)."
fi

log "Provisionnement terminé."
echo "Étapes suivantes :"
echo "  1. Renseigne BRAWLSTARS_API_TOKEN dans .env"
echo "  2. bash scripts/deploy.sh"
echo "  3. Configure Nginx + SSL (voir DEPLOYMENT.md, section 8)"
