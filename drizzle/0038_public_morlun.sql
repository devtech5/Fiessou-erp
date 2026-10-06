CREATE TYPE "public"."statut_prestation" AS ENUM('demandee', 'confirmee', 'realisee', 'payee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."unite_tarif" AS ENUM('heure', 'jour', 'prestation', 'forfait', 'metre_carre');--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'prestation';--> statement-breakpoint
CREATE TABLE "prestataires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tiers_id" uuid NOT NULL,
	"metiers" text[] NOT NULL,
	"specialites" text,
	"zone" text,
	"tarif" bigint,
	"unite_tarif" "unite_tarif",
	"formel" boolean DEFAULT false NOT NULL,
	"mobile_money" text,
	"disponible" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "prestataires_tiers_unique" UNIQUE("organization_id","tiers_id"),
	CONSTRAINT "prestataires_metiers" CHECK (cardinality("prestataires"."metiers") > 0),
	CONSTRAINT "prestataires_tarif" CHECK ("prestataires"."tarif" IS NULL OR "prestataires"."tarif" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prestataire_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"objet" text NOT NULL,
	"description" text,
	"lieu" text,
	"prevue_le" date,
	"montant_convenu" bigint,
	"statut" "statut_prestation" DEFAULT 'demandee' NOT NULL,
	"realisee_le" timestamp with time zone,
	"note" integer,
	"avis" text,
	"montant_paye" bigint,
	"retenue" bigint,
	"compte_charge" text,
	"ecriture_numero" text,
	"payee_le" timestamp with time zone,
	"projet_id" uuid,
	"motif_annulation" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "prestations_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "prestations_note" CHECK ("prestations"."note" IS NULL OR "prestations"."note" BETWEEN 1 AND 5),
	CONSTRAINT "prestations_montants" CHECK (("prestations"."montant_convenu" IS NULL OR "prestations"."montant_convenu" >= 0) AND ("prestations"."retenue" IS NULL OR "prestations"."retenue" >= 0)),
	CONSTRAINT "prestations_payee" CHECK ("prestations"."statut" <> 'payee' OR ("prestations"."montant_paye" IS NOT NULL AND "prestations"."ecriture_numero" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "prestataires" ADD CONSTRAINT "prestataires_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestataires" ADD CONSTRAINT "prestataires_tiers_id_tiers_id_fk" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_prestataire_id_prestataires_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."prestataires"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prestations_prestataire_idx" ON "prestations" USING btree ("organization_id","prestataire_id");--> statement-breakpoint
CREATE INDEX "prestations_statut_idx" ON "prestations" USING btree ("organization_id","statut");--> statement-breakpoint
ALTER TABLE "prestataires" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prestations" ENABLE ROW LEVEL SECURITY;