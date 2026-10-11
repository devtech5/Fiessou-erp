CREATE TYPE "public"."numerotation_poste" AS ENUM('appareil', 'serveur');--> statement-breakpoint
CREATE TYPE "public"."espace_restauration" AS ENUM('restaurant', 'maquis');--> statement-breakpoint
CREATE TYPE "public"."etat_preparation" AS ENUM('envoyee', 'prete', 'servie', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."poste_production" AS ENUM('cuisine', 'bar');--> statement-breakpoint
CREATE TYPE "public"."statut_commande_salle" AS ENUM('ouverte', 'encaissee', 'annulee');--> statement-breakpoint
CREATE TABLE "commandes_salle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"espace" "espace_restauration" NOT NULL,
	"numero" text NOT NULL,
	"table_id" uuid,
	"libelle" text,
	"couverts" integer,
	"serveur_id" uuid,
	"statut" "statut_commande_salle" DEFAULT 'ouverte' NOT NULL,
	"ouverte_le" timestamp with time zone DEFAULT now() NOT NULL,
	"close_le" timestamp with time zone,
	"vente_id" uuid,
	"motif_annulation" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "commandes_salle_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "commandes_salle_couverts" CHECK ("commandes_salle"."couverts" IS NULL OR "commandes_salle"."couverts" BETWEEN 1 AND 500),
	CONSTRAINT "commandes_salle_annulation_motivee" CHECK ("commandes_salle"."statut" <> 'annulee' OR "commandes_salle"."motif_annulation" IS NOT NULL),
	CONSTRAINT "commandes_salle_encaissee_a_sa_vente" CHECK ("commandes_salle"."statut" <> 'encaissee' OR "commandes_salle"."vente_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "lignes_commande_salle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"commande_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"designation" text NOT NULL,
	"quantite" bigint NOT NULL,
	"prix_unitaire" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"poste" "poste_production" DEFAULT 'cuisine' NOT NULL,
	"etat" "etat_preparation" DEFAULT 'envoyee' NOT NULL,
	"envoyee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"prete_le" timestamp with time zone,
	"servie_le" timestamp with time zone,
	"motif_annulation" text,
	"user_id" uuid,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lignes_commande_salle_quantite" CHECK ("lignes_commande_salle"."quantite" > 0),
	CONSTRAINT "lignes_commande_salle_prix" CHECK ("lignes_commande_salle"."prix_unitaire" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tables_salle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"espace" "espace_restauration" NOT NULL,
	"nom" text NOT NULL,
	"zone" text,
	"places" integer,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tables_salle_nom_unique" UNIQUE("organization_id","espace","nom"),
	CONSTRAINT "tables_salle_places" CHECK ("tables_salle"."places" IS NULL OR "tables_salle"."places" BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "postes_caisse" ADD COLUMN "numerotation" "numerotation_poste" DEFAULT 'appareil' NOT NULL;--> statement-breakpoint
ALTER TABLE "commandes_salle" ADD CONSTRAINT "commandes_salle_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_salle" ADD CONSTRAINT "commandes_salle_table_id_tables_salle_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables_salle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_salle" ADD CONSTRAINT "commandes_salle_vente_id_ventes_id_fk" FOREIGN KEY ("vente_id") REFERENCES "public"."ventes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande_salle" ADD CONSTRAINT "lignes_commande_salle_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande_salle" ADD CONSTRAINT "lignes_commande_salle_commande_id_commandes_salle_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes_salle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande_salle" ADD CONSTRAINT "lignes_commande_salle_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_salle" ADD CONSTRAINT "tables_salle_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commandes_salle_une_ouverte_par_table" ON "commandes_salle" USING btree ("table_id") WHERE "commandes_salle"."statut" = 'ouverte' AND "commandes_salle"."table_id" IS NOT NULL AND "commandes_salle"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "commandes_salle_org_idx" ON "commandes_salle" USING btree ("organization_id","espace","statut");--> statement-breakpoint
CREATE INDEX "commandes_salle_vente_idx" ON "commandes_salle" USING btree ("vente_id");--> statement-breakpoint
CREATE INDEX "lignes_commande_salle_commande_idx" ON "lignes_commande_salle" USING btree ("commande_id","ordre");--> statement-breakpoint
CREATE INDEX "lignes_commande_salle_production_idx" ON "lignes_commande_salle" USING btree ("organization_id","etat","poste");--> statement-breakpoint
CREATE INDEX "tables_salle_org_idx" ON "tables_salle" USING btree ("organization_id","espace","actif");--> statement-breakpoint
ALTER TABLE "tables_salle" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commandes_salle" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lignes_commande_salle" ENABLE ROW LEVEL SECURITY;