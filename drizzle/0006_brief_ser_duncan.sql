CREATE TYPE "public"."ligne_vente_kind" AS ENUM('article', 'prestation', 'frais');--> statement-breakpoint
CREATE TYPE "public"."moyen_reglement" AS ENUM('especes', 'mobile_money', 'carte', 'banque', 'credit');--> statement-breakpoint
CREATE TYPE "public"."statut_vente" AS ENUM('encaissee', 'annulee');--> statement-breakpoint
CREATE TABLE "lignes_vente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vente_id" uuid NOT NULL,
	"parent_line_id" uuid,
	"line_kind" "ligne_vente_kind" DEFAULT 'article' NOT NULL,
	"article_id" uuid,
	"designation" text NOT NULL,
	"quantite" bigint NOT NULL,
	"unite" text DEFAULT 'piece' NOT NULL,
	"prix_unitaire" bigint DEFAULT 0 NOT NULL,
	"remise" bigint DEFAULT 0 NOT NULL,
	"taux_tva" integer DEFAULT 0 NOT NULL,
	"montant_ht" bigint DEFAULT 0 NOT NULL,
	"montant_tva" bigint DEFAULT 0 NOT NULL,
	"compte_vente" text DEFAULT '701' NOT NULL,
	"cout_unitaire" bigint DEFAULT 0 NOT NULL,
	"worker_id" uuid,
	"cout_main_oeuvre" bigint DEFAULT 0 NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lignes_vente_quantite_positive" CHECK ("lignes_vente"."quantite" > 0),
	CONSTRAINT "lignes_vente_montants_positifs" CHECK ("lignes_vente"."prix_unitaire" >= 0 AND "lignes_vente"."remise" >= 0 AND "lignes_vente"."montant_ht" >= 0),
	CONSTRAINT "lignes_vente_taux_borne" CHECK ("lignes_vente"."taux_tva" >= 0 AND "lignes_vente"."taux_tva" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "postes_caisse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"prefixe" text NOT NULL,
	"depot_id" uuid NOT NULL,
	"dernier_numero" integer DEFAULT 0 NOT NULL,
	"device_id" text,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "postes_caisse_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "postes_caisse_numero_positif" CHECK ("postes_caisse"."dernier_numero" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reglements_vente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vente_id" uuid NOT NULL,
	"moyen" "moyen_reglement" NOT NULL,
	"montant" bigint NOT NULL,
	"reference" text,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reglements_vente_montant_positif" CHECK ("reglements_vente"."montant" > 0)
);
--> statement-breakpoint
CREATE TABLE "ventes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"caisse_id" uuid NOT NULL,
	"depot_id" uuid NOT NULL,
	"numero_seq" integer NOT NULL,
	"numero" text NOT NULL,
	"client_id" uuid,
	"statut" "statut_vente" DEFAULT 'encaissee' NOT NULL,
	"encaissee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"total_brut" bigint DEFAULT 0 NOT NULL,
	"total_remise" bigint DEFAULT 0 NOT NULL,
	"total_ht" bigint DEFAULT 0 NOT NULL,
	"total_tva" bigint DEFAULT 0 NOT NULL,
	"total_ttc" bigint DEFAULT 0 NOT NULL,
	"especes_recues" bigint DEFAULT 0 NOT NULL,
	"monnaie_rendue" bigint DEFAULT 0 NOT NULL,
	"device_id" text,
	"user_id" uuid,
	"motif_annulation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ventes_numero_unique" UNIQUE("organization_id","caisse_id","numero_seq"),
	CONSTRAINT "ventes_totaux_positifs" CHECK ("ventes"."total_ttc" >= 0 AND "ventes"."total_brut" >= 0),
	CONSTRAINT "ventes_numero_positif" CHECK ("ventes"."numero_seq" > 0),
	CONSTRAINT "ventes_annulation_motivee" CHECK ("ventes"."statut" <> 'annulee' OR "ventes"."motif_annulation" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "lignes_vente" ADD CONSTRAINT "lignes_vente_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_vente" ADD CONSTRAINT "lignes_vente_vente_id_ventes_id_fk" FOREIGN KEY ("vente_id") REFERENCES "public"."ventes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_vente" ADD CONSTRAINT "lignes_vente_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postes_caisse" ADD CONSTRAINT "postes_caisse_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postes_caisse" ADD CONSTRAINT "postes_caisse_depot_id_depots_id_fk" FOREIGN KEY ("depot_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_vente" ADD CONSTRAINT "reglements_vente_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_vente" ADD CONSTRAINT "reglements_vente_vente_id_ventes_id_fk" FOREIGN KEY ("vente_id") REFERENCES "public"."ventes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_caisse_id_postes_caisse_id_fk" FOREIGN KEY ("caisse_id") REFERENCES "public"."postes_caisse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_depot_id_depots_id_fk" FOREIGN KEY ("depot_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lignes_vente_vente_idx" ON "lignes_vente" USING btree ("vente_id","ordre");--> statement-breakpoint
CREATE INDEX "lignes_vente_article_idx" ON "lignes_vente" USING btree ("organization_id","article_id");--> statement-breakpoint
CREATE INDEX "lignes_vente_parent_idx" ON "lignes_vente" USING btree ("parent_line_id");--> statement-breakpoint
CREATE INDEX "postes_caisse_org_idx" ON "postes_caisse" USING btree ("organization_id","actif");--> statement-breakpoint
CREATE INDEX "reglements_vente_vente_idx" ON "reglements_vente" USING btree ("vente_id");--> statement-breakpoint
CREATE INDEX "reglements_vente_org_moyen_idx" ON "reglements_vente" USING btree ("organization_id","moyen");--> statement-breakpoint
CREATE INDEX "ventes_org_date_idx" ON "ventes" USING btree ("organization_id","encaissee_le");--> statement-breakpoint
CREATE INDEX "ventes_org_client_idx" ON "ventes" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "ventes_caisse_idx" ON "ventes" USING btree ("caisse_id","numero_seq");--> statement-breakpoint
-- Toute nouvelle table du schéma public active RLS, sans exception : Supabase
-- y expose une API REST lisible avec la clé publiable, qui est publique par
-- conception. Une table oubliée ici laisse le chiffre d'affaires et le fichier
-- des tickets de toutes les entreprises en libre accès.
--
-- Activée dans la MÊME migration que la création : une migration qui crée la
-- table et une seconde qui la protège laissent une fenêtre ouverte entre les
-- deux. Aucune policy — Fiessou se connecte avec un rôle propriétaire qui
-- contourne RLS, et l'isolation reste dans le filtre organization_id.
ALTER TABLE "postes_caisse" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ventes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lignes_vente" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reglements_vente" ENABLE ROW LEVEL SECURITY;
