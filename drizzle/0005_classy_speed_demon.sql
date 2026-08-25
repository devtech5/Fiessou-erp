CREATE TYPE "public"."type_depot" AS ENUM('depot', 'magasin', 'vehicule');--> statement-breakpoint
CREATE TYPE "public"."type_mouvement" AS ENUM('reception', 'vente', 'transfert', 'ajustement', 'retour');--> statement-breakpoint
CREATE TABLE "depots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"type" "type_depot" DEFAULT 'depot' NOT NULL,
	"ville" text,
	"adresse" text,
	"par_defaut" boolean DEFAULT false NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "depots_code_unique" UNIQUE("organization_id","code")
);
--> statement-breakpoint
CREATE TABLE "mouvements_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"depot_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"type" "type_mouvement" NOT NULL,
	"quantite" bigint NOT NULL,
	"cout_unitaire" bigint DEFAULT 0 NOT NULL,
	"piece" text NOT NULL,
	"origine_type" text,
	"origine_id" uuid,
	"depot_contrepartie_id" uuid,
	"groupe_id" uuid,
	"motif" text,
	"user_id" uuid,
	"effectue_le" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "mouvements_stock_quantite_non_nulle" CHECK ("mouvements_stock"."quantite" <> 0),
	CONSTRAINT "mouvements_stock_cout_positif" CHECK ("mouvements_stock"."cout_unitaire" >= 0),
	CONSTRAINT "mouvements_stock_transfert_contrepartie" CHECK (("mouvements_stock"."type" <> 'transfert' AND "mouvements_stock"."depot_contrepartie_id" IS NULL)
          OR ("mouvements_stock"."type" = 'transfert' AND "mouvements_stock"."depot_contrepartie_id" IS NOT NULL
              AND "mouvements_stock"."depot_contrepartie_id" <> "mouvements_stock"."depot_id"))
);
--> statement-breakpoint
ALTER TABLE "depots" ADD CONSTRAINT "depots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_depot_id_depots_id_fk" FOREIGN KEY ("depot_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_depot_contrepartie_id_depots_id_fk" FOREIGN KEY ("depot_contrepartie_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "depots_defaut_unique" ON "depots" USING btree ("organization_id") WHERE "depots"."par_defaut" AND "depots"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "depots_org_idx" ON "depots" USING btree ("organization_id","actif");--> statement-breakpoint
CREATE INDEX "mouvements_stock_solde_idx" ON "mouvements_stock" USING btree ("organization_id","article_id","depot_id");--> statement-breakpoint
CREATE INDEX "mouvements_stock_journal_idx" ON "mouvements_stock" USING btree ("organization_id","effectue_le");--> statement-breakpoint
CREATE INDEX "mouvements_stock_groupe_idx" ON "mouvements_stock" USING btree ("groupe_id");--> statement-breakpoint
-- Toute nouvelle table du schéma public active RLS, sans exception : Supabase
-- y expose une API REST lisible avec la clé publiable, qui est publique par
-- conception. Une table oubliée ici laisse l'inventaire et les mouvements de
-- toutes les entreprises en libre accès.
--
-- Activée dans la MÊME migration que la création : une migration qui crée la
-- table et une seconde qui la protège laissent une fenêtre ouverte entre les
-- deux. Aucune policy — Fiessou se connecte avec un rôle propriétaire qui
-- contourne RLS, et l'isolation reste dans le filtre organization_id.
ALTER TABLE "depots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mouvements_stock" ENABLE ROW LEVEL SECURITY;
