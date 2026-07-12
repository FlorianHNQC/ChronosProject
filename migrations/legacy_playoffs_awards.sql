-- Complément migration : playoffs + awards. Rejouable (ON CONFLICT).
-- Se rattache à la compétition « Ligue Chronos 2026 » déjà importée.
BEGIN;

INSERT INTO playoff_series (id,competition_id,round,bracket_position,team_a_id,team_b_id,team_a_label,team_b_label,best_of,team_a_wins,team_b_wins,winner_id,status,next_series_id,next_series_slot,scheduled_at,has_time) VALUES
('f1d84a29-31bf-4369-bb7a-2cbe25b71157',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'quarter',6,'2dce823f-2afb-4d77-b8cb-5dfb3c99b172','c7fff9d6-60a0-439d-a228-ca1e77417e9b','2e Ikarion','Vainqueur Play-in 1',3,2,0,'2dce823f-2afb-4d77-b8cb-5dfb3c99b172','completed','7345bb19-4aad-4131-af73-b1e4b137b4f2','team_b','2026-06-13 21:00:00',true),
('781375ff-e9d0-44d3-abdd-91503aa2cc87',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'play_in',2,'2e685172-d009-4cad-a3d4-7f92c4525571','1259a1d6-ff43-419a-b619-b09d856a2b5d','4e Ikarion','5e Hydra',3,2,0,'2e685172-d009-4cad-a3d4-7f92c4525571','completed','886300e8-ad58-43d1-8abb-8e984f7ea3ab','team_b','2026-06-06 21:00:00',true),
('7345bb19-4aad-4131-af73-b1e4b137b4f2',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'semi',7,'77056e19-d975-4ca9-b5a7-03b88126c400','2dce823f-2afb-4d77-b8cb-5dfb3c99b172','Vainqueur Quart 1','Vainqueur Quart 4',5,1,3,'2dce823f-2afb-4d77-b8cb-5dfb3c99b172','completed','712fb90c-9711-471b-b1d3-1afbe9ed4d45','team_a','2026-06-20 20:30:00',true),
('e980ad0c-aca9-4ea8-b72b-76c2e1098ec3',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'quarter',4,'40a01658-c642-46d6-954a-feb0cc03f5a2','850bcfd2-9b32-41da-bbe7-9429267a373e','1er Ikarion','3e Hydra',3,2,0,'40a01658-c642-46d6-954a-feb0cc03f5a2','completed','6483d1fc-4236-4f10-99b9-a96dba94cbfa','team_a','2026-06-14 20:30:00',true),
('886300e8-ad58-43d1-8abb-8e984f7ea3ab',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'quarter',5,'3197f936-f989-477f-88f2-b5aef0a4557e','2e685172-d009-4cad-a3d4-7f92c4525571','2e Hydra','Vainqueur Play-in 2',3,1,2,'2e685172-d009-4cad-a3d4-7f92c4525571','completed','6483d1fc-4236-4f10-99b9-a96dba94cbfa','team_b','2026-06-14 21:00:00',true),
('6483d1fc-4236-4f10-99b9-a96dba94cbfa',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'semi',8,'40a01658-c642-46d6-954a-feb0cc03f5a2','2e685172-d009-4cad-a3d4-7f92c4525571','Vainqueur Quart 2','Vainqueur Quart 3',5,3,0,'40a01658-c642-46d6-954a-feb0cc03f5a2','completed','712fb90c-9711-471b-b1d3-1afbe9ed4d45','team_b','2026-06-21 20:30:00',true),
('712fb90c-9711-471b-b1d3-1afbe9ed4d45',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'final',9,'2dce823f-2afb-4d77-b8cb-5dfb3c99b172','40a01658-c642-46d6-954a-feb0cc03f5a2','Vainqueur Demi 1','Vainqueur Demi 2',7,1,4,'40a01658-c642-46d6-954a-feb0cc03f5a2','completed',NULL,NULL,'2026-06-28 20:30:00',true),
('9a223f9d-0ad5-403c-9e55-4255911af396',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'quarter',3,'77056e19-d975-4ca9-b5a7-03b88126c400','de68d4f4-f5e9-4efb-a90f-bab8c2663951','1er Hydra','3e Ikarion',3,2,0,'77056e19-d975-4ca9-b5a7-03b88126c400','completed','7345bb19-4aad-4131-af73-b1e4b137b4f2','team_a','2026-06-15 20:00:00',true),
('1166d2c8-968b-49e7-90ef-b5e8ef5ae809',(SELECT id FROM competitions WHERE name='Ligue Chronos 2026' AND status='archived' ORDER BY closed_at DESC NULLS LAST LIMIT 1),'play_in',1,'7d5aad39-b832-4a64-a434-74dc3a969ba8','c7fff9d6-60a0-439d-a228-ca1e77417e9b','4e Hydra','5e Ikarion',3,0,2,'c7fff9d6-60a0-439d-a228-ca1e77417e9b','completed','f1d84a29-31bf-4369-bb7a-2cbe25b71157','team_b','2026-06-06 20:30:00',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO weekly_awards (id,week_date,player_id,justification,published)
SELECT v.id,v.week_date,v.player_id,v.justification,v.published FROM (VALUES
('a7f01328-f7fa-4c87-b72f-54794024dbd3','2026-03-02','aba622e3-d7db-4fb4-a939-507561f33aa2',NULL,true),
('9e21fc3c-582f-4c3e-913a-9286feb09d66','2026-03-09','0719b58e-f908-460f-ab36-bdb5baf43b19',NULL,true),
('3a465ce5-f25a-46bc-b067-033cf3678082','2026-03-16','1fe891f1-9c32-4fc6-9b13-d5f34fcf6b4f',NULL,true),
('ea1bacc2-bd74-4bb1-a676-28bdc34ce780','2026-03-23','1799851d-6074-48ee-90d8-d57c65f8e08e',NULL,true),
('c67bb628-08d0-4c87-bfe2-1312a0a4084b','2026-03-30','45018cc8-d0b6-4246-875c-7f8df8f412e7',NULL,true),
('dd11d522-0f5f-4452-9b32-6fe82ec0df37','2026-04-06','394d2f5d-4c1c-4b18-bfec-21e271061c68',NULL,true),
('cd64f64d-0208-40a6-a684-c45281e958cf','2026-04-13','98a16087-a29c-4c35-b43b-e01c05a8fdaa',NULL,true),
('36357483-1d6a-4646-835e-ed42fbdd9b83','2026-04-20','9be0aaed-347c-4321-a114-d5e408443ac5',NULL,true),
('223d2738-55ca-4918-a3aa-43e77558d1bd','2026-04-27','0719b58e-f908-460f-ab36-bdb5baf43b19',NULL,true),
('80608c70-0095-470b-85d9-d4aa6037eb82','2026-05-04','6654e410-fa33-4f1f-86fb-f7158a9d872e',NULL,true),
('067a3d82-a32a-424b-8ab6-bff9a4bb174f','2026-05-11','9be0aaed-347c-4321-a114-d5e408443ac5',NULL,true),
('fefb8d0d-0a0b-4b94-9608-b16d66b540eb','2026-05-18','7c9b8826-316d-49ce-89c2-47e74b42cfd1',NULL,true)
) AS v(id,week_date,player_id,justification,published)
WHERE v.player_id IN (SELECT id FROM players)
ON CONFLICT (id) DO NOTHING;

INSERT INTO season_awards (id,category,player_id,justification,published)
SELECT v.id,v.category,v.player_id,v.justification,v.published FROM (VALUES
('0ae18532-9a8f-497b-b4a5-8ddcc7b167e1','mvp','558e3751-661b-44db-85a7-4b88a842182e',NULL,false)
) AS v(id,category,player_id,justification,published)
WHERE v.player_id IN (SELECT id FROM players)
ON CONFLICT (id) DO NOTHING;

COMMIT;
