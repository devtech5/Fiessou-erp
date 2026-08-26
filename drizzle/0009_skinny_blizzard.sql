CREATE TYPE "public"."nature_echeance" AS ENUM('assurance', 'visite', 'garantie', 'entretien');--> statement-breakpoint
CREATE TYPE "public"."nature_intervention" AS ENUM('preventif', 'correctif', 'controle');--> statement-breakpoint
CREATE TYPE "public"."statut_actif" AS ENUM('actif', 'entretien', 'immobilise', 'cede');--> statement-breakpoint
CREATE TYPE "public"."type_actif" AS ENUM('vehicule', 'informatique', 'engin', 'mobilier');--> statement-breakpoint
CREATE TABLE "actifs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"designation" text NOT NULL,
	"type" "type_actif" DEFAULT 'vehicule' NOT NULL,
	"statut" "statut_actif" DEFAULT 'actif' NOT NULL,
	"employe_id" uuid,
	"intervenant_id" uuid,
	"proprietaire_id" uuid,
	"site" text,
	"date_acquisition" date,
	"valeur_acquisition" bigint DEFAULT 0 NOT NULL,
	"unite_compteur" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "actifs_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "actifs_valeur_positive" CHECK ("actifs"."valeur_acquisition" >= 0),
	CONSTRAINT "actifs_une_seule_affectation" CHECK ("actifs"."employe_id" IS NULL OR "actifs"."intervenant_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "echeances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actif_id" uuid NOT NULL,
	"nature" "nature_echeance" NOT NULL,
	"libelle" text,
	"echeance_le" date,
	"compteur_cible" bigint,
	"honoree_le" timestamp with time zone,
	"intervention_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "echeances_un_declencheur" CHECK ("echeances"."echeance_le" IS NOT NULL OR "echeances"."compteur_cible" IS NOT NULL),
	CONSTRAINT "echeances_compteur_positif" CHECK ("echeances"."compteur_cible" IS NULL OR "echeances"."compteur_cible" >= 0)
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"actif_id" uuid NOT NULL,
	"nature" "nature_intervention" DEFAULT 'correctif' NOT NULL,
	"libelle" text NOT NULL,
	"prestataire_id" uuid,
	"prestataire" text,
	"cout" bigint DEFAULT 0 NOT NULL,
	"facturable" boolean DEFAULT false NOT NULL,
	"effectuee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "interventions_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "interventions_cout_positif" CHECK ("interventions"."cout" >= 0)
);
--> statement-breakpoint
CREATE TABLE "releves_compteur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actif_id" uuid NOT NULL,
	"valeur" bigint NOT NULL,
	"intervention_id" uuid,
	"releve_le" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "releves_compteur_valeur_positive" CHECK ("releves_compteur"."valeur" >= 0)
);
--> statement-breakpoint
ALTER TABLE "actifs" ADD CONSTRAINT "actifs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actifs" ADD CONSTRAINT "actifs_employe_id_employees_id_fk" FOREIGN KEY ("employe_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actifs" ADD CONSTRAINT "actifs_intervenant_id_workers_id_fk" FOREIGN KEY ("intervenant_id") REFERENCES "public"."workers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actifs" ADD CONSTRAINT "actifs_proprietaire_id_tiers_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_intervention_id_interventions_id_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_prestataire_id_tiers_id_fk" FOREIGN KEY ("prestataire_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releves_compteur" ADD CONSTRAINT "releves_compteur_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releves_compteur" ADD CONSTRAINT "releves_compteur_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releves_compteur" ADD CONSTRAINT "releves_compteur_intervention_id_interventions_id_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actifs_org_statut_idx" ON "actifs" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "actifs_org_type_idx" ON "actifs" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "actifs_proprietaire_idx" ON "actifs" USING btree ("proprietaire_id");--> statement-breakpoint
CREATE INDEX "echeances_actif_idx" ON "echeances" USING btree ("organization_id","actif_id");--> statement-breakpoint
CREATE INDEX "echeances_date_idx" ON "echeances" USING btree ("organization_id","echeance_le");--> statement-breakpoint
CREATE INDEX "interventions_actif_idx" ON "interventions" USING btree ("organization_id","actif_id");--> statement-breakpoint
CREATE INDEX "interventions_journal_idx" ON "interventions" USING btree ("organization_id","effectuee_le");--> statement-breakpoint
CREATE INDEX "releves_compteur_actif_idx" ON "releves_compteur" USING btree ("actif_id","releve_le");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : Supabase expose
-- une API REST sur le schéma public, lisible avec la clé publiable. Une table
-- oubliée ici livre l'inventaire du parc, les plaques et les coûts d'entretien
-- de toutes les entreprises.
ALTER TABLE "actifs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interventions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "releves_compteur" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "echeances" ENABLE ROW LEVEL SECURITY;
