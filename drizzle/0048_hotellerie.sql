CREATE TYPE "public"."menage_chambre" AS ENUM('propre', 'a_faire');--> statement-breakpoint
CREATE TYPE "public"."nature_prestation_sejour" AS ENUM('service', 'marchandise');--> statement-breakpoint
CREATE TABLE "acomptes_sejour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sejour_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"jour" date NOT NULL,
	"montant" bigint NOT NULL,
	"moyen" "moyen_location" NOT NULL,
	"ecriture" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "acomptes_sejour_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "acomptes_sejour_montant" CHECK ("acomptes_sejour"."montant" > 0)
);
--> statement-breakpoint
CREATE TABLE "chambres_hotel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ressource_id" uuid NOT NULL,
	"etage" text,
	"capacite" integer DEFAULT 2 NOT NULL,
	"menage" "menage_chambre" DEFAULT 'propre' NOT NULL,
	"menage_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chambres_hotel_ressource_unique" UNIQUE("ressource_id"),
	CONSTRAINT "chambres_hotel_capacite" CHECK ("chambres_hotel"."capacite" > 0)
);
--> statement-breakpoint
CREATE TABLE "prestations_sejour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sejour_id" uuid NOT NULL,
	"jour" date NOT NULL,
	"libelle" text NOT NULL,
	"nature" "nature_prestation_sejour" DEFAULT 'service' NOT NULL,
	"quantite" integer DEFAULT 1 NOT NULL,
	"prix_unitaire" bigint NOT NULL,
	"montant" bigint NOT NULL,
	"taux_tva" integer DEFAULT 1800 NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "prestations_sejour_quantite" CHECK ("prestations_sejour"."quantite" > 0),
	CONSTRAINT "prestations_sejour_montant" CHECK ("prestations_sejour"."prix_unitaire" >= 0 AND "prestations_sejour"."montant" = "prestations_sejour"."prix_unitaire" * "prestations_sejour"."quantite")
);
--> statement-breakpoint
CREATE TABLE "sejours_hotel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contrat_id" uuid NOT NULL,
	"adultes" integer DEFAULT 1 NOT NULL,
	"enfants" integer DEFAULT 0 NOT NULL,
	"prix_nuit" bigint,
	"arrivee_le" timestamp with time zone,
	"moyen_caution" "moyen_location",
	"ecriture_caution" text,
	"depart_le" timestamp with time zone,
	"total_note" bigint,
	"ecriture_depart" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sejours_hotel_contrat_unique" UNIQUE("contrat_id"),
	CONSTRAINT "sejours_hotel_personnes" CHECK ("sejours_hotel"."adultes" > 0 AND "sejours_hotel"."enfants" >= 0),
	CONSTRAINT "sejours_hotel_prix" CHECK ("sejours_hotel"."prix_nuit" IS NULL OR "sejours_hotel"."prix_nuit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "voyageurs_sejour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sejour_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"prenoms" text,
	"date_naissance" date,
	"lieu_naissance" text,
	"nationalite" text NOT NULL,
	"profession" text,
	"domicile" text,
	"telephone" text,
	"piece_nature" text NOT NULL,
	"piece_numero" text NOT NULL,
	"piece_delivree_le" date,
	"provenance" text,
	"destination" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contrats_location" ADD COLUMN "pilote" text;--> statement-breakpoint
ALTER TABLE "acomptes_sejour" ADD CONSTRAINT "acomptes_sejour_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acomptes_sejour" ADD CONSTRAINT "acomptes_sejour_sejour_id_sejours_hotel_id_fk" FOREIGN KEY ("sejour_id") REFERENCES "public"."sejours_hotel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chambres_hotel" ADD CONSTRAINT "chambres_hotel_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chambres_hotel" ADD CONSTRAINT "chambres_hotel_ressource_id_ressources_id_fk" FOREIGN KEY ("ressource_id") REFERENCES "public"."ressources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations_sejour" ADD CONSTRAINT "prestations_sejour_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations_sejour" ADD CONSTRAINT "prestations_sejour_sejour_id_sejours_hotel_id_fk" FOREIGN KEY ("sejour_id") REFERENCES "public"."sejours_hotel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sejours_hotel" ADD CONSTRAINT "sejours_hotel_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sejours_hotel" ADD CONSTRAINT "sejours_hotel_contrat_id_contrats_location_id_fk" FOREIGN KEY ("contrat_id") REFERENCES "public"."contrats_location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyageurs_sejour" ADD CONSTRAINT "voyageurs_sejour_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyageurs_sejour" ADD CONSTRAINT "voyageurs_sejour_sejour_id_sejours_hotel_id_fk" FOREIGN KEY ("sejour_id") REFERENCES "public"."sejours_hotel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acomptes_sejour_idx" ON "acomptes_sejour" USING btree ("sejour_id");--> statement-breakpoint
CREATE INDEX "chambres_hotel_org_idx" ON "chambres_hotel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prestations_sejour_idx" ON "prestations_sejour" USING btree ("sejour_id");--> statement-breakpoint
CREATE INDEX "sejours_hotel_org_idx" ON "sejours_hotel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "voyageurs_sejour_idx" ON "voyageurs_sejour" USING btree ("sejour_id");--> statement-breakpoint
CREATE INDEX "voyageurs_sejour_org_idx" ON "voyageurs_sejour" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "acomptes_sejour" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chambres_hotel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prestations_sejour" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sejours_hotel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "voyageurs_sejour" ENABLE ROW LEVEL SECURITY;
