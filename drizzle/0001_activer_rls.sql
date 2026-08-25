-- Sécurité au niveau ligne sur toutes les tables du socle.
--
-- Pourquoi c'est indispensable, et pas seulement prudent :
--
-- Supabase expose automatiquement une API REST sur le schéma `public`, lisible
-- avec la clé publiable. Cette clé est publique par conception : elle circule
-- dans le bundle JavaScript de toute application front qui l'utilise. Sans
-- RLS, quiconque la détient lit l'intégralité des tables — y compris les
-- données de toutes les entreprises clientes.
--
-- Aucune policy n'est créée volontairement. Sans policy, RLS refuse tout aux
-- rôles `anon` et `authenticated`. Fiessou ne passe pas par PostgREST : il se
-- connecte directement à PostgreSQL avec un rôle propriétaire, qui contourne
-- RLS. L'isolation entre entreprises reste assurée par le filtrage sur
-- organization_id dans le code, comme prévu dès la conception du socle.
--
-- Si une policy devait être ajoutée un jour pour un accès direct depuis un
-- client, elle devrait impérativement filtrer sur organization_id.

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organization_modules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verification_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document_sequences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "entity_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "change_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_cursors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_mutations" ENABLE ROW LEVEL SECURITY;
