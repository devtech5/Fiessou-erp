ALTER TYPE "public"."origine_piece" ADD VALUE 'tva';--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'cloture';--> statement-breakpoint
CREATE TABLE "declarations_tva" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mois" text NOT NULL,
	"collectee" bigint NOT NULL,
	"deductible" bigint NOT NULL,
	"credit_anterieur" bigint DEFAULT 0 NOT NULL,
	"a_payer" bigint NOT NULL,
	"credit_reporte" bigint DEFAULT 0 NOT NULL,
	"ecriture" text,
	"deposee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"deposee_par_user_id" uuid NOT NULL,
	"payee_le" date,
	"ecriture_paiement" text,
	"compte_tresorerie_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "declarations_tva_mois_unique" UNIQUE("organization_id","mois"),
	CONSTRAINT "declarations_tva_mois_format" CHECK ("declarations_tva"."mois" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "declarations_tva_montants" CHECK ("declarations_tva"."a_payer" >= 0 AND "declarations_tva"."credit_reporte" >= 0 AND ("declarations_tva"."a_payer" = 0 OR "declarations_tva"."credit_reporte" = 0))
);
--> statement-breakpoint
CREATE TABLE "exercices_clotures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"exercice" text NOT NULL,
	"resultat" bigint NOT NULL,
	"ecriture" text NOT NULL,
	"cloture_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cloture_par_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "exercices_clotures_unique" UNIQUE("organization_id","exercice"),
	CONSTRAINT "exercices_clotures_format" CHECK ("exercices_clotures"."exercice" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
ALTER TABLE "declarations_tva" ADD CONSTRAINT "declarations_tva_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_tva" ADD CONSTRAINT "declarations_tva_compte_tresorerie_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_tresorerie_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercices_clotures" ADD CONSTRAINT "exercices_clotures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_tva" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercices_clotures" ENABLE ROW LEVEL SECURITY;