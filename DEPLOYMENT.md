# Déploiement de Chronos (VPS Ubuntu + PostgreSQL + PM2 + Nginx)

Chronos est une application unique : le serveur Node (Express) sert **à la fois
l'API et le client** (build Vite) sur un seul port. Nginx fait simplement office
de reverse-proxy avec SSL.

---

## 1. Prérequis (une fois par serveur)

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL + Nginx
sudo apt-get install -y postgresql nginx

# PM2 (gestionnaire de process)
sudo npm install -g pm2
```

> Node ≥ 20.11 est requis (le serveur utilise `import.meta.dirname`).

## 2. Base de données

```bash
sudo -u postgres psql -c "CREATE USER chronos WITH PASSWORD 'un_mot_de_passe_fort';"
sudo -u postgres psql -c "CREATE DATABASE chronos OWNER chronos;"
```

## 3. Récupérer le code

```bash
cd /opt   # ou /root, /home/<user>…
git clone <url_du_depot> chronos
cd chronos
```

## 4. Variables d'environnement

Créer `/opt/chronos/.env` (jamais commité) :

```env
DATABASE_URL="postgresql://chronos:un_mot_de_passe_fort@127.0.0.1:5432/chronos"
PORT=5000
SESSION_SECRET=<64 hex — générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
ADMIN_EMAIL=toi@exemple.com
ADMIN_PASSWORD=<mot de passe admin>
# Token API Brawl Stars (developer.brawlstars.com) — l'IP du VPS doit être autorisée sur le token
BRAWLSTARS_API_TOKEN=<token>
```

> L'IP autorisée du token doit être **celle du VPS** (pas ton poste). Vérifie l'IP du serveur avec `curl https://api.ipify.org`.

## 5. Installer, migrer le schéma, importer les données

```bash
npm ci                 # installe toutes les dépendances (build + runtime)
npm run db:push        # crée les tables (Drizzle)

# Import de la ligue historique (si tu as les fichiers SQL générés) :
psql "$DATABASE_URL" -f migrations/legacy_import.sql
psql "$DATABASE_URL" -f migrations/legacy_playoffs_awards.sql

# Images uploadées (logos/avatars) depuis l'ancien VPS, si tu les as :
#   scp -r ancien:/chemin/public/uploads ./public/uploads
```

## 6. Build de production

```bash
npm run build          # -> client dans dist/public, serveur bundlé dans dist/index.js
```

## 7. Lancer avec PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save                # sauvegarde la liste des process
pm2 startup             # génère la commande pour démarrer PM2 au boot (exécute la ligne affichée)
pm2 logs chronos        # vérifier le démarrage (tu verras l'admin par défaut créé, puis « en écoute sur le port 5000 »)
```

L'app écoute sur `127.0.0.1:5000`. Connecte-toi ensuite sur `/login` avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## 8. Nginx (reverse-proxy + SSL)

`/etc/nginx/sites-available/chronos` :

```nginx
server {
    server_name chronos.exemple.com;

    client_max_body_size 10M;   # uploads d'images

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chronos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL gratuit (Let's Encrypt)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chronos.exemple.com
```

> Si tu es derrière HTTPS, ajoute `app.set("trust proxy", 1)` côté serveur si tu passes les cookies en `secure` un jour. Actuellement le cookie de session est `sameSite=lax` sans `secure`, ce qui fonctionne derrière un proxy HTTPS standard.

## 9. Mises à jour

```bash
cd /opt/chronos
git pull
npm ci
npm run db:push        # si le schéma a changé
npm run build
pm2 restart chronos
```

---

## Récapitulatif des variables d'environnement

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL. |
| `PORT` | Port d'écoute (défaut 5000). |
| `SESSION_SECRET` | Secret de signature des sessions (obligatoire en prod). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin créé au premier démarrage si la table `users` est vide. |
| `BRAWLSTARS_API_TOKEN` | API officielle Brawl Stars (IP du VPS autorisée). |

Les sessions sont stockées en base (`user_sessions`, créée automatiquement) → elles survivent aux redémarrages.
