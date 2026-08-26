CREATE TYPE "public"."mode_remuneration" AS ENUM('journee', 'tache', 'unite', 'forfait');--> statement-breakpoint
CREATE TYPE "public"."type_contrat" AS ENUM('cdi', 'cdd', 'stage', 'essai');--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'bon_paiement' BEFORE 'saisie';--> statement-breakpoint
CREATE TABLE "bons_paiement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"worker_id" uuid NOT NULL,
	"montant" bigint NOT NULL,
	"moyen" "moyen_reglement" DEFAULT 'especes' NOT NULL,
	"reference" text,
	"ecriture_numero" text,
	"paye_le" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bons_paiement_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "bons_paiement_montant_positif" CHECK ("bons_paiement"."montant" > 0),
	CONSTRAINT "bons_paiement_moyen_reel" CHECK ("bons_paiement"."moyen" <> 'credit')
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"matricule" text NOT NULL,
	"nom" text NOT NULL,
	"poste" text NOT NULL,
	"contrat" "type_contrat" DEFAULT 'cdi' NOT NULL,
	"debut" date NOT NULL,
	"fin" date,
	"salaire_base" bigint DEFAULT 0 NOT NULL,
	"numero_cnps" text,
	"telephone" text,
	"email" text,
	"adresse" text,
	"user_id" uuid,
	"actif" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "employees_matricule_unique" UNIQUE("organization_id","matricule"),
	CONSTRAINT "employees_salaire_positif" CHECK ("employees"."salaire_base" >= 0),
	CONSTRAINT "employees_terme_selon_contrat" CHECK (("employees"."contrat" = 'cdi' AND "employees"."fin" IS NULL)
          OR ("employees"."contrat" <> 'cdi' AND "employees"."fin" IS NOT NULL AND "employees"."fin" >= "employees"."debut"))
);
--> statement-breakpoint
CREATE TABLE "pointages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"quantite" bigint NOT NULL,
	"taux" bigint NOT NULL,
	"mode" "mode_remuneration" NOT NULL,
	"unite_libelle" text NOT NULL,
	"montant" bigint NOT NULL,
	"affectation" text,
	"piece" text NOT NULL,
	"effectue_le" timestamp with time zone DEFAULT now() NOT NULL,
	"motif" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pointages_quantite_non_nulle" CHECK ("pointages"."quantite" <> 0),
	CONSTRAINT "pointages_taux_positif" CHECK ("pointages"."taux" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"qualification" text NOT NULL,
	"telephone" text,
	"telephone_paiement" text,
	"mode" "mode_remuneration" DEFAULT 'journee' NOT NULL,
	"taux" bigint DEFAULT 0 NOT NULL,
	"unite_libelle" text DEFAULT 'jour' NOT NULL,
	"affectation" text,
	"actif" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "workers_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "workers_taux_positif" CHECK ("workers"."taux" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bons_paiement" ADD CONSTRAINT "bons_paiement_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bons_paiement" ADD CONSTRAINT "bons_paiement_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bons_paiement_worker_idx" ON "bons_paiement" USING btree ("organization_id","worker_id");--> statement-breakpoint
CREATE INDEX "bons_paiement_journal_idx" ON "bons_paiement" USING btree ("organization_id","paye_le");--> statement-breakpoint
CREATE INDEX "employees_org_actif_idx" ON "employees" USING btree ("organization_id","actif");--> statement-breakpoint
CREATE INDEX "employees_org_fin_idx" ON "employees" USING btree ("organization_id","fin");--> statement-breakpoint
CREATE INDEX "pointages_worker_idx" ON "pointages" USING btree ("organization_id","worker_id");--> statement-breakpoint
CREATE INDEX "pointages_journal_idx" ON "pointages" USING btree ("organization_id","effectue_le");--> statement-breakpoint
CREATE INDEX "workers_org_actif_idx" ON "workers" USING btree ("organization_id","actif");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : Supabase expose
-- une API REST sur le schéma public, lisible avec la clé publiable. Une table
-- oubliée ici livre les salaires, les numéros CNPS et les téléphones de tout
-- le personnel de toutes les entreprises.
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pointages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bons_paiement" ENABLE ROW LEVEL SECURITY;
