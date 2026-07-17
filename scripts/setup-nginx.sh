#!/usr/bin/env bash
#
# Configure Nginx (reverse-proxy) + SSL Let's Encrypt pour Chronos.
# À lancer UNE fois (puis à nouveau seulement si le domaine change).
#
# Usage :
#   sudo bash scripts/setup-nginx.sh chronos.tondomaine.com [email-admin]
#
# - 1er argument (obligatoire) : le domaine/sous-domaine qui pointe déjà sur ce VPS.
# - 2e argument (optionnel)    : l'email pour Let's Encrypt (sinon --register-unsafely-without-email).
#
set -euo pipefail

log()  { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Lance ce script avec sudo."

DOMAIN="${1:-}"
EMAIL="${2:-}"
[ -n "$DOMAIN" ] || fail "Domaine manquant. Usage : sudo bash scripts/setup-nginx.sh chronos.tondomaine.com [email]"

# Se placer à la racine du dépôt pour lire .env.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Port d'écoute réel de l'app = celui que PM2 lance (ecosystem.config.cjs).
# Fallback sur .env, puis 5010. On resynchronise ensuite .env pour éviter toute divergence.
PORT="$(grep -oP 'PORT:\s*"\K[0-9]+' ecosystem.config.cjs 2>/dev/null | head -n1 || true)"
[ -n "$PORT" ] || PORT="$(grep -oP '^PORT=\K[0-9]+' .env 2>/dev/null | head -n1 || true)"
PORT="${PORT:-5010}"
if [ -f .env ]; then
  if grep -q '^PORT=' .env; then sed -i "s/^PORT=.*/PORT=${PORT}/" .env; else printf 'PORT=%s\n' "$PORT" >> .env; fi
fi
log "Domaine : $DOMAIN   |   App locale : 127.0.0.1:$PORT"

# Vérif DNS : le domaine doit résoudre vers ce serveur (avertissement seulement).
MYIP="$(curl -fsSL https://api.ipify.org || true)"
DNIP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || true)"
if [ -n "$MYIP" ] && [ -n "$DNIP" ] && [ "$MYIP" != "$DNIP" ]; then
  printf "\033[1;33m! Attention : %s pointe sur %s mais l'IP de ce serveur est %s. Le certificat SSL échouera tant que le DNS n'est pas à jour.\033[0m\n" "$DOMAIN" "$DNIP" "$MYIP"
fi

log "Installation de Nginx + Certbot (si besoin)"
command -v nginx >/dev/null 2>&1 || apt-get install -y nginx
command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx

log "Écriture du vhost /etc/nginx/sites-available/chronos"
cat > /etc/nginx/sites-available/chronos <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/chronos /etc/nginx/sites-enabled/chronos

# Désactiver tout AUTRE vhost activé qui revendique le même domaine (sinon conflit
# de server_name : Nginx en ignore un et Certbot risque de poser le SSL sur le mauvais).
DOM_RE="${DOMAIN//./\\.}"
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = "chronos" ] && continue
  if grep -Eq "server_name[^;]*(^|[[:space:]])${DOM_RE}([[:space:]]|;)" "$f"; then
    printf "\033[1;33m! %s revendique aussi %s → désactivé (le fichier reste dans sites-available, réversible).\033[0m\n" "$(basename "$f")" "$DOMAIN"
    rm -f "$f"
  fi
done

log "Test de la configuration Nginx"
nginx -t
systemctl reload nginx

# Ouverture des ports si ufw est actif.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  log "Ouverture des ports HTTP/HTTPS (ufw)"
  ufw allow 'Nginx Full' || true
fi

log "Obtention du certificat SSL (Let's Encrypt)"
if [ -n "$EMAIL" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
else
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

log "Terminé."
echo "Chronos est accessible sur : https://${DOMAIN}"
echo "Connexion admin : https://${DOMAIN}/login  (ADMIN_EMAIL / ADMIN_PASSWORD du .env)"
echo "Renouvellement SSL : automatique (timer certbot). Test : sudo certbot renew --dry-run"
