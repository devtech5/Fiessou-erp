CREATE TYPE "public"."journal_code" AS ENUM('VE', 'AC', 'CA', 'BQ', 'OD');--> statement-breakpoint
CREATE TYPE "public"."origine_piece" AS ENUM('facture', 'avoir', 'reglement', 'achat', 'bon_caisse', 'vente_pos', 'saisie');--> statement-breakpoint
CREATE TYPE "public"."statut_ecriture" AS ENUM('brouillon', 'validee', 'verrouillee');--> statement-breakpoint
CREATE TABLE "ecritures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"journal" "journal_code" NOT NULL,
	"numero" text NOT NULL,
	"exercice" text NOT NULL,
	"date_ecriture" date NOT NULL,
	"libelle" text NOT NULL,
	"origine" "origine_piece" NOT NULL,
	"piece_id" uuid,
	"piece_numero" text,
	"statut" "statut_ecriture" DEFAULT 'validee' NOT NULL,
	"verrouillee_le" timestamp with time zone,
	"passee_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ecritures_piece_unique" UNIQUE("organization_id","origine","piece_id"),
	CONSTRAINT "ecritures_numero_unique" UNIQUE("organization_id","journal","exercice","numero")
);
--> statement-breakpoint
CREATE TABLE "lignes_ecriture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecriture_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"compte" text NOT NULL,
	"libelle_compte" text NOT NULL,
	"auxiliaire" text,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"lettrage" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lignes_ecriture_sens_unique" CHECK (("lignes_ecriture"."debit" = 0) OR ("lignes_ecriture"."credit" = 0)),
	CONSTRAINT "lignes_ecriture_montants_positifs" CHECK ("lignes_ecriture"."debit" >= 0 AND "lignes_ecriture"."credit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecritures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_ecriture" ADD CONSTRAINT "lignes_ecriture_ecriture_id_ecritures_id_fk" FOREIGN KEY ("ecriture_id") REFERENCES "public"."ecritures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_ecriture" ADD CONSTRAINT "lignes_ecriture_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ecritures_org_date_idx" ON "ecritures" USING btree ("organization_id","date_ecriture");--> statement-breakpoint
CREATE INDEX "ecritures_piece_idx" ON "ecritures" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "lignes_ecriture_ecriture_idx" ON "lignes_ecriture" USING btree ("ecriture_id");--> statement-breakpoint
CREATE INDEX "lignes_ecriture_compte_idx" ON "lignes_ecriture" USING btree ("organization_id","compte");--> statement-breakpoint
CREATE INDEX "lignes_ecriture_lettrage_idx" ON "lignes_ecriture" USING btree ("organization_id","lettrage");--> statement-breakpoint
-- Toute nouvelle table du schéma public doit activer RLS, sans exception :
-- Supabase y expose une API REST lisible avec la clé publiable, qui est
-- publique par conception. Une table oubliée ici est une table lisible par
-- n'importe qui. Aucune policy — Fiessou se connecte avec un rôle propriétaire
-- qui contourne RLS, et l'isolation reste dans le filtre organization_id.
ALTER TABLE "ecritures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lignes_ecriture" ENABLE ROW LEVEL SECURITY;
