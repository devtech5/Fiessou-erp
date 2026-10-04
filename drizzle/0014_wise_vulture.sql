CREATE TYPE "public"."etat_restitution" AS ENUM('bon', 'endommage', 'perdu');--> statement-breakpoint
CREATE TYPE "public"."moyen_location" AS ENUM('especes', 'mobile_money', 'banque');--> statement-breakpoint
CREATE TYPE "public"."statut_contrat" AS ENUM('reserve', 'en_cours', 'restitue', 'annule');--> statement-breakpoint
CREATE TYPE "public"."statut_ressource" AS ENUM('active', 'maintenance', 'retiree');--> statement-breakpoint
CREATE TYPE "public"."type_ressource" AS ENUM('equipement', 'chambre', 'salle', 'creneau');--> statement-breakpoint
CREATE TABLE "abonnements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"telephone" text,
	"client_id" uuid,
	"formule" text NOT NULL,
	"debut" date NOT NULL,
	"fin" date NOT NULL,
	"montant" bigint NOT NULL,
	"seances_incluses" integer,
	"moyen_encaissement" "moyen_location" NOT NULL,
	"ecriture" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "abonnements_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "abonnements_periode" CHECK ("abonnements"."fin" >= "abonnements"."debut"),
	CONSTRAINT "abonnements_montant" CHECK ("abonnements"."montant" >= 0),
	CONSTRAINT "abonnements_seances" CHECK ("abonnements"."seances_incluses" IS NULL OR "abonnements"."seances_incluses" > 0)
);
--> statement-breakpoint
CREATE TABLE "contrats_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"ressource_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"quantite" integer DEFAULT 1 NOT NULL,
	"debut" date NOT NULL,
	"fin" date NOT NULL,
	"base_tarif" text NOT NULL,
	"montant" bigint NOT NULL,
	"caution" bigint DEFAULT 0 NOT NULL,
	"statut" "statut_contrat" DEFAULT 'reserve' NOT NULL,
	"remis_le" timestamp with time zone,
	"moyen_encaissement" "moyen_location",
	"ecriture_remise" text,
	"restitue_le" timestamp with time zone,
	"etat_restitution" "etat_restitution",
	"retenue" bigint DEFAULT 0 NOT NULL,
	"ecriture_restitution" text,
	"motif" text,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "contrats_location_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "contrats_location_periode" CHECK ("contrats_location"."fin" >= "contrats_location"."debut"),
	CONSTRAINT "contrats_location_quantite" CHECK ("contrats_location"."quantite" > 0),
	CONSTRAINT "contrats_location_montants" CHECK ("contrats_location"."montant" >= 0 AND "contrats_location"."caution" >= 0 AND "contrats_location"."retenue" >= 0 AND "contrats_location"."retenue" <= "contrats_location"."caution"),
	CONSTRAINT "contrats_location_annulation_motivee" CHECK ("contrats_location"."statut" <> 'annule' OR "contrats_location"."motif" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "passages_abonnement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"abonnement_id" uuid NOT NULL,
	"venu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ressources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"designation" text NOT NULL,
	"type" "type_ressource" DEFAULT 'equipement' NOT NULL,
	"categorie" text,
	"statut" "statut_ressource" DEFAULT 'active' NOT NULL,
	"quantite" integer DEFAULT 1 NOT NULL,
	"tarif_jour" bigint,
	"tarif_semaine" bigint,
	"tarif_mois" bigint,
	"caution" bigint DEFAULT 0 NOT NULL,
	"taux_tva" integer DEFAULT 1800 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ressources_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "ressources_quantite_positive" CHECK ("ressources"."quantite" > 0),
	CONSTRAINT "ressources_tarifs_positifs" CHECK (coalesce("ressources"."tarif_jour", 0) >= 0 AND coalesce("ressources"."tarif_semaine", 0) >= 0
        AND coalesce("ressources"."tarif_mois", 0) >= 0 AND "ressources"."caution" >= 0)
);
--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrats_location" ADD CONSTRAINT "contrats_location_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrats_location" ADD CONSTRAINT "contrats_location_ressource_id_ressources_id_fk" FOREIGN KEY ("ressource_id") REFERENCES "public"."ressources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrats_location" ADD CONSTRAINT "contrats_location_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages_abonnement" ADD CONSTRAINT "passages_abonnement_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages_abonnement" ADD CONSTRAINT "passages_abonnement_abonnement_id_abonnements_id_fk" FOREIGN KEY ("abonnement_id") REFERENCES "public"."abonnements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ressources" ADD CONSTRAINT "ressources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonnements_org_idx" ON "abonnements" USING btree ("organization_id","fin");--> statement-breakpoint
CREATE INDEX "contrats_location_ressource_idx" ON "contrats_location" USING btree ("ressource_id","debut","fin");--> statement-breakpoint
CREATE INDEX "contrats_location_org_idx" ON "contrats_location" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "passages_abonnement_idx" ON "passages_abonnement" USING btree ("abonnement_id","venu_le");--> statement-breakpoint
CREATE INDEX "ressources_org_idx" ON "ressources" USING btree ("organization_id","statut");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : une table
-- oubliée ici livre les clients, contrats et cautions de toutes les entreprises.
ALTER TABLE "ressources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contrats_location" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "abonnements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passages_abonnement" ENABLE ROW LEVEL SECURITY;
