CREATE TYPE "public"."base_commission" AS ENUM('ca_ht', 'marge');--> statement-breakpoint
CREATE TYPE "public"."statut_commission" AS ENUM('validee', 'payee');--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'commission';--> statement-breakpoint
CREATE TABLE "commerciaux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"telephone" text,
	"user_id" uuid,
	"employee_id" uuid,
	"base" "base_commission" DEFAULT 'ca_ht' NOT NULL,
	"taux_bp" integer DEFAULT 0 NOT NULL,
	"paliers" jsonb,
	"fixe_mensuel" bigint DEFAULT 0 NOT NULL,
	"objectif_mensuel" bigint DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "commerciaux_nom_unique" UNIQUE("organization_id","nom"),
	CONSTRAINT "commerciaux_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "commerciaux_montants" CHECK ("commerciaux"."taux_bp" BETWEEN 0 AND 10000 AND "commerciaux"."fixe_mensuel" >= 0 AND "commerciaux"."objectif_mensuel" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"commercial_id" uuid NOT NULL,
	"mois" text NOT NULL,
	"ca_ht" bigint NOT NULL,
	"marge" bigint NOT NULL,
	"base" "base_commission" NOT NULL,
	"variable" bigint NOT NULL,
	"fixe" bigint NOT NULL,
	"total" bigint NOT NULL,
	"statut" "statut_commission" DEFAULT 'validee' NOT NULL,
	"validee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"validee_par_user_id" uuid NOT NULL,
	"payee_le" date,
	"mode_paiement" text,
	"ecriture" text,
	"compte_tresorerie_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "commissions_mois_unique" UNIQUE("commercial_id","mois"),
	CONSTRAINT "commissions_mois_format" CHECK ("commissions"."mois" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "commissions_total" CHECK ("commissions"."total" = "commissions"."variable" + "commissions"."fixe" AND "commissions"."total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ventes" ADD COLUMN "commercial_id" uuid;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD COLUMN "commercial_id" uuid;--> statement-breakpoint
ALTER TABLE "commerciaux" ADD CONSTRAINT "commerciaux_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_commercial_id_commerciaux_id_fk" FOREIGN KEY ("commercial_id") REFERENCES "public"."commerciaux"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_commercial_id_commerciaux_id_fk" FOREIGN KEY ("commercial_id") REFERENCES "public"."commerciaux"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD CONSTRAINT "pieces_commerciales_commercial_id_commerciaux_id_fk" FOREIGN KEY ("commercial_id") REFERENCES "public"."commerciaux"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerciaux" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commissions" ENABLE ROW LEVEL SECURITY;