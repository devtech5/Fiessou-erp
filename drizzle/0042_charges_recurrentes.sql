CREATE TYPE "public"."periodicite_charge" AS ENUM('mensuelle', 'trimestrielle', 'annuelle');--> statement-breakpoint
CREATE TABLE "budgets_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"famille" text NOT NULL,
	"montant_mensuel" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "budgets_charges_famille_unique" UNIQUE("organization_id","famille"),
	CONSTRAINT "budgets_charges_montant" CHECK ("budgets_charges"."montant_mensuel" > 0)
);
--> statement-breakpoint
CREATE TABLE "charges_recurrentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"categorie" text NOT NULL,
	"montant" bigint NOT NULL,
	"taux_tva" integer DEFAULT 0 NOT NULL,
	"periodicite" "periodicite_charge" NOT NULL,
	"premiere_echeance" date NOT NULL,
	"fournisseur_id" uuid,
	"fournisseur_libelle" text,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "charges_recurrentes_montant" CHECK ("charges_recurrentes"."montant" > 0 AND "charges_recurrentes"."taux_tva" >= 0)
);
--> statement-breakpoint
CREATE TABLE "echeances_charge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"periode" text NOT NULL,
	"date_echeance" date NOT NULL,
	"depense_id" uuid,
	"ignoree" boolean DEFAULT false NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "echeances_charge_periode_unique" UNIQUE("charge_id","periode"),
	CONSTRAINT "echeances_charge_periode" CHECK ("echeances_charge"."periode" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "echeances_charge_issue" CHECK ("echeances_charge"."ignoree" OR "echeances_charge"."depense_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "budgets_charges" ADD CONSTRAINT "budgets_charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges_recurrentes" ADD CONSTRAINT "charges_recurrentes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges_recurrentes" ADD CONSTRAINT "charges_recurrentes_fournisseur_id_tiers_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances_charge" ADD CONSTRAINT "echeances_charge_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances_charge" ADD CONSTRAINT "echeances_charge_charge_id_charges_recurrentes_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges_recurrentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances_charge" ADD CONSTRAINT "echeances_charge_depense_id_depenses_id_fk" FOREIGN KEY ("depense_id") REFERENCES "public"."depenses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charges_recurrentes_org_idx" ON "charges_recurrentes" USING btree ("organization_id","actif");--> statement-breakpoint
CREATE INDEX "echeances_charge_org_idx" ON "echeances_charge" USING btree ("organization_id","periode");--> statement-breakpoint
ALTER TABLE "charges_recurrentes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "echeances_charge" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "budgets_charges" ENABLE ROW LEVEL SECURITY;