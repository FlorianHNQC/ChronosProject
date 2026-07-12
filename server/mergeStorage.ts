/**
 * Fusion de joueurs (nettoyage des doublons issus de l'import sans fusion).
 *
 * Fusionne le joueur `sourceId` DANS `targetId` : réassigne toutes les
 * références (stats, rosters, tags, changelog, awards, drifters) vers la cible,
 * puis supprime la source. La cible conserve son identité (pseudo, avatar, tag,
 * Elo). Opération transactionnelle.
 */
import { sql } from "drizzle-orm";
import { db } from "./db";

export const mergeStore = {
  async mergePlayers(targetId: string, sourceId: string): Promise<void> {
    if (!targetId || !sourceId) {
      throw Object.assign(new Error("Cible et source requises."), { status: 400 });
    }
    if (targetId === sourceId) {
      throw Object.assign(new Error("Cible et source identiques."), { status: 400 });
    }

    await db.transaction(async (tx) => {
      // FK simples : réassignation directe.
      await tx.execute(sql`update match_player_stats set player_id = ${targetId} where player_id = ${sourceId}`);
      await tx.execute(sql`update elo_changelog set player_id = ${targetId} where player_id = ${sourceId}`);
      await tx.execute(sql`update weekly_awards set player_id = ${targetId} where player_id = ${sourceId}`);
      await tx.execute(sql`update season_awards set player_id = ${targetId} where player_id = ${sourceId}`);
      await tx.execute(sql`update drifter_engagements set player_id = ${targetId} where player_id = ${sourceId}`);
      await tx.execute(sql`update matches set drifter_home_id = ${targetId} where drifter_home_id = ${sourceId}`);
      await tx.execute(sql`update matches set drifter_away_id = ${targetId} where drifter_away_id = ${sourceId}`);

      // team_players : contrainte unique (team_id, player_id) → supprimer les
      // collisions avant de réassigner le reste.
      await tx.execute(sql`
        delete from team_players s
        where s.player_id = ${sourceId}
          and exists (select 1 from team_players t where t.player_id = ${targetId} and t.team_id = s.team_id)`);
      await tx.execute(sql`update team_players set player_id = ${targetId} where player_id = ${sourceId}`);

      // player_tags : contrainte unique (player_id, tag_id) → même logique.
      await tx.execute(sql`
        delete from player_tags s
        where s.player_id = ${sourceId}
          and exists (select 1 from player_tags t where t.player_id = ${targetId} and t.tag_id = s.tag_id)`);
      await tx.execute(sql`update player_tags set player_id = ${targetId} where player_id = ${sourceId}`);

      // Suppression de la source.
      await tx.execute(sql`delete from players where id = ${sourceId}`);
    });
  },
};
