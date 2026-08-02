/**
 * Nettoyage des doublons de profils issus de l'import (cf. ONBOARDING).
 *
 * Chaque pseudo dupliqué a exactement 2 profils : un « réel » (avec des matchs
 * et son Elo calculé) et un « vide » (elo 1000, 0 match, présent dans un roster).
 * On fusionne le vide DANS le réel : la cible (réel) garde son identité et son
 * Elo, absorbe l'appartenance d'équipe du vide, puis le vide est supprimé.
 *
 * Sécurité : on ne fusionne QUE les groupes où exactement UN profil a des matchs
 * (motif vérifié : 0 groupe ambigu). Les autres sont ignorés et signalés.
 *
 * Lancement (base locale) :
 *   DATABASE_URL="postgresql://chronos:chronos123@127.0.0.1:5433/chronos" \
 *     npx tsx scripts/merge-duplicates.ts
 */
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { mergeStore } from "../server/mergeStorage";

type Row = { id: string; pseudo: string; k: string; nstats: number };

async function main() {
  const res = await db.execute(sql`
    WITH dup AS (
      SELECT lower(trim(pseudo)) k FROM players
      WHERE pseudo <> '(joueur inconnu)' GROUP BY 1 HAVING count(*) > 1
    )
    SELECT p.id, p.pseudo, lower(trim(p.pseudo)) AS k,
      (SELECT count(*) FROM match_player_stats s WHERE s.player_id = p.id)::int AS nstats
    FROM players p
    WHERE lower(trim(p.pseudo)) IN (SELECT k FROM dup)
    ORDER BY k, nstats DESC
  `);
  const rows = (res as unknown as { rows: Row[] }).rows;

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!groups.has(r.k)) groups.set(r.k, []);
    groups.get(r.k)!.push(r);
  }

  let merged = 0;
  let skipped = 0;
  for (const [k, g] of groups) {
    const withStats = g.filter((r) => r.nstats > 0);
    if (withStats.length !== 1) {
      console.warn(`SKIP "${k}" : ${withStats.length} profils avec matchs (ambigu, non fusionné)`);
      skipped++;
      continue;
    }
    const target = withStats[0];
    const sources = g.filter((r) => r.id !== target.id);
    for (const s of sources) {
      await mergeStore.mergePlayers(target.id, s.id);
      console.log(`✓ "${s.pseudo}" ${s.id.slice(0, 8)} (vide) → ${target.id.slice(0, 8)} (${target.nstats} matchs)`);
      merged++;
    }
  }

  console.log(`\n✔ ${merged} doublon(s) fusionné(s), ${skipped} groupe(s) ignoré(s).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
