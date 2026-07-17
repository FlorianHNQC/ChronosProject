/**
 * Configuration PM2 pour Chronos.
 * Les secrets (DATABASE_URL, SESSION_SECRET, ADMIN_*, BRAWLSTARS_API_TOKEN…)
 * sont lus depuis le fichier .env à la racine (chargé par server/load-env.ts),
 * et NE doivent PAS figurer ici.
 *
 * Démarrage :  pm2 start ecosystem.config.cjs
 * Logs :       pm2 logs chronos
 * Redémarrage : pm2 restart chronos
 */
module.exports = {
  apps: [
    {
      name: "chronos",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "5010",
      },
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
