CREATE TYPE "public"."nature_tiers" AS ENUM('entreprise', 'particulier');--> statement-breakpoint
CREATE TYPE "public"."code_unite" AS ENUM('piece', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'm3', 'heure', 'jour');--> statement-breakpoint
CREATE TYPE "public"."type_article" AS ENUM('marchandise', 'service');--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nature" "nature_tiers" DEFAULT 'entreprise' NOT NULL,
	"nom" text NOT NULL,
	"est_client" boolean DEFAULT true NOT NULL,
	"est_fournisseur" boolean DEFAULT false NOT NULL,
	"telephone" text,
	"email" text,
	"adresse" text,
	"ville" text,
	"pays_code" text,
	"identifiant_fiscal" text,
	"secteur" text,
	"compte_client" text,
	"compte_fournisseur" text,
	"plafond_encours" bigint DEFAULT 0 NOT NULL,
	"delai_reglement_jours" integer DEFAULT 0 NOT NULL,
	"delai_livraison_jours" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tiers_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "tiers_compte_client_unique" UNIQUE("organization_id","compte_client"),
	CONSTRAINT "tiers_compte_fournisseur_unique" UNIQUE("organization_id","compte_fournisseur"),
	CONSTRAINT "tiers_role_obligatoire" CHECK ("tiers"."est_client" OR "tiers"."est_fournisseur"),
	CONSTRAINT "tiers_delais_positifs" CHECK ("tiers"."delai_reglement_jours" >= 0 AND "tiers"."delai_livraison_jours" >= 0 AND "tiers"."plafond_encours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"famille_id" uuid,
	"reference" text NOT NULL,
	"designation" text NOT NULL,
	"type" "type_article" DEFAULT 'marchandise' NOT NULL,
	"unite" "code_unite" DEFAULT 'piece' NOT NULL,
	"conditionnement" text,
	"prix_vente" bigint DEFAULT 0 NOT NULL,
	"prix_achat" bigint DEFAULT 0 NOT NULL,
	"taux_tva" integer,
	"compte_vente" text,
	"compte_achat" text,
	"suivi_stock" boolean DEFAULT true NOT NULL,
	"seuil_alerte" bigint DEFAULT 0 NOT NULL,
	"fournisseur_id" uuid,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "articles_reference_unique" UNIQUE("organization_id","reference"),
	CONSTRAINT "articles_prix_positifs" CHECK ("articles"."prix_vente" >= 0 AND "articles"."prix_achat" >= 0 AND "articles"."seuil_alerte" >= 0),
	CONSTRAINT "articles_taux_borne" CHECK ("articles"."taux_tva" IS NULL OR ("articles"."taux_tva" >= 0 AND "articles"."taux_tva" <= 10000)),
	CONSTRAINT "articles_service_non_stocke" CHECK ("articles"."type" <> 'service' OR "articles"."suivi_stock" = false)
);
--> statement-breakpoint
CREATE TABLE "familles_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"compte_vente" text DEFAULT '701' NOT NULL,
	"compte_achat" text DEFAULT '601' NOT NULL,
	"taux_tva" integer DEFAULT 1800 NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "familles_article_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "familles_article_taux_borne" CHECK ("familles_article"."taux_tva" >= 0 AND "familles_article"."taux_tva" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_famille_id_familles_article_id_fk" FOREIGN KEY ("famille_id") REFERENCES "public"."familles_article"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_fournisseur_id_tiers_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "familles_article" ADD CONSTRAINT "familles_article_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tiers_org_nom_idx" ON "tiers" USING btree ("organization_id","nom");--> statement-breakpoint
CREATE INDEX "tiers_org_client_idx" ON "tiers" USING btree ("organization_id","est_client");--> statement-breakpoint
CREATE INDEX "tiers_org_fournisseur_idx" ON "tiers" USING btree ("organization_id","est_fournisseur");--> statement-breakpoint
CREATE INDEX "articles_org_designation_idx" ON "articles" USING btree ("organization_id","designation");--> statement-breakpoint
CREATE INDEX "articles_org_famille_idx" ON "articles" USING btree ("organization_id","famille_id");--> statement-breakpoint
CREATE INDEX "articles_org_fournisseur_idx" ON "articles" USING btree ("organization_id","fournisseur_id");--> statement-breakpoint
CREATE INDEX "familles_article_org_idx" ON "familles_article" USING btree ("organization_id");--> statement-breakpoint
-- Toute nouvelle table du schéma public doit activer RLS, sans exception :
-- Supabase y expose une API REST lisible avec la clé publiable, qui est
-- publique par conception. Une table oubliée ici est une table lisible par
-- n'importe qui. Aucune policy — Fiessou se connecte avec un rôle propriétaire
-- qui contourne RLS, et l'isolation reste dans le filtre organization_id.
--
-- Activé dans la MÊME migration que la création : une migration qui crée la
-- table et une seconde qui la protège laissent une fenêtre pendant laquelle le
-- fichier clients est en libre accès.
ALTER TABLE "tiers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "familles_article" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;
