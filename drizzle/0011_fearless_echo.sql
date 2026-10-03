CREATE TYPE "public"."nature_mission" AS ENUM('livraison', 'chantier', 'collecte', 'projet', 'intervention');--> statement-breakpoint
CREATE TYPE "public"."statut_mission" AS ENUM('planifiee', 'en_cours', 'terminee', 'echouee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."type_preuve" AS ENUM('photo', 'position', 'signature', 'note', 'formulaire');--> statement-breakpoint
CREATE TABLE "etapes_mission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"ordre" integer NOT NULL,
	"libelle" text NOT NULL,
	"preuves_requises" "type_preuve"[] DEFAULT '{}'::type_preuve[] NOT NULL,
	"faite_le" timestamp with time zone,
	"faite_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "etapes_mission_ordre_unique" UNIQUE("mission_id","ordre")
);
--> statement-breakpoint
CREATE TABLE "formulaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"usage" text,
	"champs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "formulaires_nom_unique" UNIQUE("organization_id","nom"),
	CONSTRAINT "formulaires_champs_tableau" CHECK (jsonb_typeof("formulaires"."champs") = 'array')
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"nature" "nature_mission" NOT NULL,
	"titre" text NOT NULL,
	"lieu" text,
	"statut" "statut_mission" DEFAULT 'planifiee' NOT NULL,
	"employe_id" uuid,
	"intervenant_id" uuid,
	"client_id" uuid,
	"actif_id" uuid,
	"montant" bigint DEFAULT 0 NOT NULL,
	"echeance_le" timestamp with time zone,
	"debute_le" timestamp with time zone,
	"cloture_le" timestamp with time zone,
	"motif" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "missions_reference_unique" UNIQUE("organization_id","reference"),
	CONSTRAINT "missions_montant_positif" CHECK ("missions"."montant" >= 0),
	CONSTRAINT "missions_un_seul_executant" CHECK ("missions"."employe_id" IS NULL OR "missions"."intervenant_id" IS NULL),
	CONSTRAINT "missions_issue_motivee" CHECK ("missions"."statut" NOT IN ('echouee', 'annulee') OR "missions"."motif" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "preuves_mission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"etape_id" uuid,
	"type" "type_preuve" NOT NULL,
	"texte" text,
	"fichier_cle" text,
	"latitude_micro" integer,
	"longitude_micro" integer,
	"reponse_id" uuid,
	"prise_le" timestamp with time zone NOT NULL,
	"recue_le" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "preuves_mission_contenu" CHECK (CASE "preuves_mission"."type"
        WHEN 'position' THEN "preuves_mission"."latitude_micro" IS NOT NULL AND "preuves_mission"."longitude_micro" IS NOT NULL
        WHEN 'photo' THEN "preuves_mission"."fichier_cle" IS NOT NULL
        WHEN 'formulaire' THEN "preuves_mission"."reponse_id" IS NOT NULL
        ELSE "preuves_mission"."texte" IS NOT NULL
      END),
	CONSTRAINT "preuves_mission_position_bornee" CHECK (("preuves_mission"."latitude_micro" IS NULL OR "preuves_mission"."latitude_micro" BETWEEN -90000000 AND 90000000)
        AND ("preuves_mission"."longitude_micro" IS NULL OR "preuves_mission"."longitude_micro" BETWEEN -180000000 AND 180000000))
);
--> statement-breakpoint
CREATE TABLE "reponses_formulaire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"formulaire_id" uuid NOT NULL,
	"mission_id" uuid,
	"champs" jsonb NOT NULL,
	"valeurs" jsonb NOT NULL,
	"prise_le" timestamp with time zone NOT NULL,
	"recue_le" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "etapes_mission" ADD CONSTRAINT "etapes_mission_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapes_mission" ADD CONSTRAINT "etapes_mission_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulaires" ADD CONSTRAINT "formulaires_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_employe_id_employees_id_fk" FOREIGN KEY ("employe_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_intervenant_id_workers_id_fk" FOREIGN KEY ("intervenant_id") REFERENCES "public"."workers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preuves_mission" ADD CONSTRAINT "preuves_mission_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preuves_mission" ADD CONSTRAINT "preuves_mission_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preuves_mission" ADD CONSTRAINT "preuves_mission_etape_id_etapes_mission_id_fk" FOREIGN KEY ("etape_id") REFERENCES "public"."etapes_mission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponses_formulaire" ADD CONSTRAINT "reponses_formulaire_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponses_formulaire" ADD CONSTRAINT "reponses_formulaire_formulaire_id_formulaires_id_fk" FOREIGN KEY ("formulaire_id") REFERENCES "public"."formulaires"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponses_formulaire" ADD CONSTRAINT "reponses_formulaire_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etapes_mission_mission_idx" ON "etapes_mission" USING btree ("mission_id","ordre");--> statement-breakpoint
CREATE INDEX "etapes_mission_org_idx" ON "etapes_mission" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "formulaires_org_idx" ON "formulaires" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "missions_org_statut_idx" ON "missions" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "missions_org_echeance_idx" ON "missions" USING btree ("organization_id","echeance_le");--> statement-breakpoint
CREATE INDEX "missions_employe_idx" ON "missions" USING btree ("employe_id");--> statement-breakpoint
CREATE INDEX "missions_intervenant_idx" ON "missions" USING btree ("intervenant_id");--> statement-breakpoint
CREATE INDEX "preuves_mission_mission_idx" ON "preuves_mission" USING btree ("mission_id","prise_le");--> statement-breakpoint
CREATE INDEX "preuves_mission_etape_idx" ON "preuves_mission" USING btree ("etape_id");--> statement-breakpoint
CREATE INDEX "reponses_formulaire_form_idx" ON "reponses_formulaire" USING btree ("formulaire_id","prise_le");--> statement-breakpoint
CREATE INDEX "reponses_formulaire_mission_idx" ON "reponses_formulaire" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "reponses_formulaire_org_idx" ON "reponses_formulaire" USING btree ("organization_id");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : Supabase expose
-- une API REST sur le schéma public, lisible avec la clé publiable. Une table
-- oubliée ici livre les positions GPS, les photos et les signatures de toutes
-- les entreprises.
ALTER TABLE "missions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "etapes_mission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preuves_mission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "formulaires" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reponses_formulaire" ENABLE ROW LEVEL SECURITY;
