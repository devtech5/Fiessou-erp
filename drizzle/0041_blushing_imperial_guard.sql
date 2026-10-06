CREATE TYPE "public"."motif_ajustement_conge" AS ENUM('reprise', 'majoration', 'correction');--> statement-breakpoint
CREATE TYPE "public"."nature_conge" AS ENUM('paye', 'maladie', 'maternite', 'paternite', 'evenement_familial', 'sans_solde', 'recuperation', 'autre');--> statement-breakpoint
CREATE TYPE "public"."source_presence" AS ENUM('automatique', 'manuel');--> statement-breakpoint
CREATE TYPE "public"."statut_conge" AS ENUM('demande', 'approuve', 'refuse', 'annule');--> statement-breakpoint
CREATE TABLE "ajustements_conge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"jour" date NOT NULL,
	"motif" "motif_ajustement_conge" NOT NULL,
	"centiemes" integer NOT NULL,
	"note" text,
	"cree_par_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ajustements_conge_borne" CHECK ("ajustements_conge"."centiemes" BETWEEN -100000 AND 100000)
);
--> statement-breakpoint
CREATE TABLE "conges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"nature" "nature_conge" DEFAULT 'paye' NOT NULL,
	"debut" date NOT NULL,
	"fin" date NOT NULL,
	"debut_demi" boolean DEFAULT false NOT NULL,
	"fin_demi" boolean DEFAULT false NOT NULL,
	"jours_centiemes" integer NOT NULL,
	"motif" text,
	"justificatif" text,
	"statut" "statut_conge" DEFAULT 'demande' NOT NULL,
	"demande_par_user_id" uuid NOT NULL,
	"decide_par_user_id" uuid,
	"decide_le" timestamp with time zone,
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "conges_numero" UNIQUE("organization_id","numero"),
	CONSTRAINT "conges_periode" CHECK ("conges"."fin" >= "conges"."debut"),
	CONSTRAINT "conges_jours" CHECK ("conges"."jours_centiemes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "jours_feries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"jour" date NOT NULL,
	"libelle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "jours_feries_jour" UNIQUE("organization_id","jour")
);
--> statement-breakpoint
CREATE TABLE "presences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"employee_id" uuid,
	"jour" date NOT NULL,
	"arrivee" timestamp with time zone NOT NULL,
	"derniere_activite" timestamp with time zone NOT NULL,
	"depart" timestamp with time zone,
	"source" "source_presence" DEFAULT 'automatique' NOT NULL,
	"corrige_par_user_id" uuid,
	"motif" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "presences_qui" CHECK ("presences"."user_id" IS NOT NULL OR "presences"."employee_id" IS NOT NULL),
	CONSTRAINT "presences_ordre" CHECK ("presences"."derniere_activite" >= "presences"."arrivee" AND ("presences"."depart" IS NULL OR "presences"."depart" >= "presences"."arrivee"))
);
--> statement-breakpoint
CREATE TABLE "reglages_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pointage_auto" boolean DEFAULT true NOT NULL,
	"heure_arrivee" text DEFAULT '08:00' NOT NULL,
	"heure_depart" text DEFAULT '17:00' NOT NULL,
	"tolerance_minutes" integer DEFAULT 15 NOT NULL,
	"jours_travailles" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
	"conges_centiemes_par_mois" integer NOT NULL,
	"decompte" text DEFAULT 'ouvrables' NOT NULL,
	"verifie_le" timestamp with time zone,
	"verifie_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reglages_presence_org" UNIQUE("organization_id"),
	CONSTRAINT "reglages_presence_heures" CHECK ("reglages_presence"."heure_arrivee" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "reglages_presence"."heure_depart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "reglages_presence_tolerance" CHECK ("reglages_presence"."tolerance_minutes" BETWEEN 0 AND 240),
	CONSTRAINT "reglages_presence_taux" CHECK ("reglages_presence"."conges_centiemes_par_mois" BETWEEN 0 AND 1000),
	CONSTRAINT "reglages_presence_decompte" CHECK ("reglages_presence"."decompte" IN ('ouvrables', 'ouvres')),
	CONSTRAINT "reglages_presence_jours" CHECK (cardinality("reglages_presence"."jours_travailles") > 0 AND "reglages_presence"."jours_travailles" <@ '{1,2,3,4,5,6,7}'::integer[])
);
--> statement-breakpoint
ALTER TABLE "ajustements_conge" ADD CONSTRAINT "ajustements_conge_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustements_conge" ADD CONSTRAINT "ajustements_conge_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conges" ADD CONSTRAINT "conges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conges" ADD CONSTRAINT "conges_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jours_feries" ADD CONSTRAINT "jours_feries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presences" ADD CONSTRAINT "presences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presences" ADD CONSTRAINT "presences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglages_presence" ADD CONSTRAINT "reglages_presence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ajustements_conge_salarie" ON "ajustements_conge" USING btree ("organization_id","employee_id","jour");--> statement-breakpoint
CREATE INDEX "conges_salarie" ON "conges" USING btree ("organization_id","employee_id","debut");--> statement-breakpoint
CREATE INDEX "conges_statut" ON "conges" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE UNIQUE INDEX "presences_compte_jour" ON "presences" USING btree ("organization_id","user_id","jour") WHERE "presences"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "presences_salarie_jour" ON "presences" USING btree ("organization_id","employee_id","jour") WHERE "presences"."employee_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "presences_org_jour" ON "presences" USING btree ("organization_id","jour");--> statement-breakpoint
ALTER TABLE "reglages_presence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "presences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jours_feries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ajustements_conge" ENABLE ROW LEVEL SECURITY;