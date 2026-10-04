CREATE TYPE "public"."statut_periode_paie" AS ENUM('preparation', 'validee');--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'paie';--> statement-breakpoint
CREATE TABLE "bulletins_paie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"periode_id" uuid NOT NULL,
	"employe_id" uuid NOT NULL,
	"numero" text,
	"matricule" text NOT NULL,
	"nom" text NOT NULL,
	"poste" text NOT NULL,
	"numero_cnps" text,
	"salaire_base" bigint NOT NULL,
	"primes_imposables" bigint DEFAULT 0 NOT NULL,
	"indemnites_non_imposables" bigint DEFAULT 0 NOT NULL,
	"retenues_diverses" bigint DEFAULT 0 NOT NULL,
	"brut" bigint NOT NULL,
	"cnps_salarie" bigint NOT NULL,
	"base_imposable" bigint NOT NULL,
	"impot" bigint NOT NULL,
	"net" bigint NOT NULL,
	"cnps_patronal" bigint NOT NULL,
	"prestations_familiales" bigint NOT NULL,
	"accident_travail" bigint NOT NULL,
	"cout_total" bigint NOT NULL,
	"paye_le" date,
	"paiement_ecriture" text,
	"compte_tresorerie_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bulletins_paie_salarie_unique" UNIQUE("periode_id","employe_id"),
	CONSTRAINT "bulletins_paie_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "bulletins_paie_net" CHECK ("bulletins_paie"."net" >= 0 AND "bulletins_paie"."brut" >= 0),
	CONSTRAINT "bulletins_paie_paye" CHECK ("bulletins_paie"."paye_le" IS NULL OR "bulletins_paie"."paiement_ecriture" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "parametres_paie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bareme" jsonb NOT NULL,
	"verifie_par_user_id" uuid,
	"verifie_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "parametres_paie_organisation_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "periodes_paie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mois" text NOT NULL,
	"statut" "statut_periode_paie" DEFAULT 'preparation' NOT NULL,
	"bareme_applique" jsonb,
	"total_brut" bigint DEFAULT 0 NOT NULL,
	"total_net" bigint DEFAULT 0 NOT NULL,
	"total_cnps" bigint DEFAULT 0 NOT NULL,
	"total_impot" bigint DEFAULT 0 NOT NULL,
	"total_patronal" bigint DEFAULT 0 NOT NULL,
	"ecriture" text,
	"validee_le" timestamp with time zone,
	"validee_par_user_id" uuid,
	"cnps_versee_le" date,
	"cnps_ecriture" text,
	"impot_verse_le" date,
	"impot_ecriture" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "periodes_paie_mois_unique" UNIQUE("organization_id","mois"),
	CONSTRAINT "periodes_paie_mois_format" CHECK ("periodes_paie"."mois" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "periodes_paie_validee" CHECK ("periodes_paie"."statut" = 'preparation' OR ("periodes_paie"."ecriture" IS NOT NULL AND "periodes_paie"."bareme_applique" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_periode_id_periodes_paie_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."periodes_paie"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_employe_id_employees_id_fk" FOREIGN KEY ("employe_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_compte_tresorerie_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_tresorerie_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametres_paie" ADD CONSTRAINT "parametres_paie_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodes_paie" ADD CONSTRAINT "periodes_paie_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bulletins_paie_periode_idx" ON "bulletins_paie" USING btree ("periode_id");--> statement-breakpoint
CREATE INDEX "bulletins_paie_employe_idx" ON "bulletins_paie" USING btree ("organization_id","employe_id");--> statement-breakpoint
-- RLS dans la même migration que la création des tables.
ALTER TABLE "parametres_paie" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "periodes_paie" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ENABLE ROW LEVEL SECURITY;