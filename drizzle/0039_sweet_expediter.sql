CREATE TYPE "public"."sens_convention" AS ENUM('client', 'fournisseur', 'partenariat');--> statement-breakpoint
CREATE TYPE "public"."statut_consultation" AS ENUM('brouillon', 'ouverte', 'cloturee', 'attribuee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."statut_offre" AS ENUM('invitee', 'recue', 'retenue', 'ecartee');--> statement-breakpoint
CREATE TYPE "public"."statut_soumission" AS ENUM('veille', 'en_preparation', 'deposee', 'gagnee', 'perdue', 'abandonnee');--> statement-breakpoint
CREATE TYPE "public"."type_marche" AS ENUM('public', 'prive', 'bailleur');--> statement-breakpoint
CREATE TABLE "avenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"convention_id" uuid NOT NULL,
	"rang" integer NOT NULL,
	"objet" text NOT NULL,
	"signe_le" date NOT NULL,
	"nouvelle_fin" date,
	"nouveau_montant" bigint,
	"chemin" text,
	"nom_fichier" text,
	"type_mime" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "avenants_rang_unique" UNIQUE("convention_id","rang")
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"objet" text NOT NULL,
	"description" text,
	"criteres" text,
	"budget" bigint,
	"date_limite" date,
	"poids_prix_bp" integer DEFAULT 6000 NOT NULL,
	"statut" "statut_consultation" DEFAULT 'brouillon' NOT NULL,
	"attribuee_le" timestamp with time zone,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "consultations_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "consultations_poids" CHECK ("consultations"."poids_prix_bp" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "conventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"intitule" text NOT NULL,
	"sens" "sens_convention" NOT NULL,
	"partenaire" text NOT NULL,
	"tiers_id" uuid,
	"objet" text,
	"montant" bigint,
	"debut" date NOT NULL,
	"fin" date,
	"reconduction_tacite" boolean DEFAULT false NOT NULL,
	"preavis_jours" integer DEFAULT 30 NOT NULL,
	"resiliee_le" date,
	"motif_resiliation" text,
	"chemin" text,
	"nom_fichier" text,
	"type_mime" text,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "conventions_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "conventions_dates" CHECK ("conventions"."fin" IS NULL OR "conventions"."fin" >= "conventions"."debut"),
	CONSTRAINT "conventions_preavis" CHECK ("conventions"."preavis_jours" BETWEEN 0 AND 730)
);
--> statement-breakpoint
CREATE TABLE "offres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"consultation_id" uuid NOT NULL,
	"tiers_id" uuid NOT NULL,
	"statut" "statut_offre" DEFAULT 'invitee' NOT NULL,
	"montant" bigint,
	"delai_jours" integer,
	"note_technique" integer,
	"commentaire" text,
	"recue_le" timestamp with time zone,
	"chemin" text,
	"nom_fichier" text,
	"type_mime" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "offres_unique" UNIQUE("consultation_id","tiers_id"),
	CONSTRAINT "offres_note" CHECK ("offres"."note_technique" IS NULL OR "offres"."note_technique" BETWEEN 0 AND 100),
	CONSTRAINT "offres_montant" CHECK ("offres"."montant" IS NULL OR "offres"."montant" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pieces_soumission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"soumission_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"rang" integer DEFAULT 0 NOT NULL,
	"fournie" boolean DEFAULT false NOT NULL,
	"chemin" text,
	"nom_fichier" text,
	"type_mime" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "soumissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"reference" text,
	"intitule" text NOT NULL,
	"autorite" text NOT NULL,
	"client_id" uuid,
	"type" "type_marche" DEFAULT 'public' NOT NULL,
	"lots" text,
	"budget_estime" bigint,
	"montant_propose" bigint,
	"caution" bigint,
	"caution_restituee" boolean DEFAULT false NOT NULL,
	"date_limite" timestamp with time zone,
	"deposee_le" timestamp with time zone,
	"statut" "statut_soumission" DEFAULT 'veille' NOT NULL,
	"motif_resultat" text,
	"responsable_id" uuid,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "soumissions_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "soumissions_montants" CHECK (("soumissions"."budget_estime" IS NULL OR "soumissions"."budget_estime" >= 0) AND ("soumissions"."montant_propose" IS NULL OR "soumissions"."montant_propose" >= 0) AND ("soumissions"."caution" IS NULL OR "soumissions"."caution" >= 0))
);
--> statement-breakpoint
ALTER TABLE "avenants" ADD CONSTRAINT "avenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avenants" ADD CONSTRAINT "avenants_convention_id_conventions_id_fk" FOREIGN KEY ("convention_id") REFERENCES "public"."conventions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conventions" ADD CONSTRAINT "conventions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conventions" ADD CONSTRAINT "conventions_tiers_id_tiers_id_fk" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offres" ADD CONSTRAINT "offres_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offres" ADD CONSTRAINT "offres_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offres" ADD CONSTRAINT "offres_tiers_id_tiers_id_fk" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_soumission" ADD CONSTRAINT "pieces_soumission_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_soumission" ADD CONSTRAINT "pieces_soumission_soumission_id_soumissions_id_fk" FOREIGN KEY ("soumission_id") REFERENCES "public"."soumissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soumissions" ADD CONSTRAINT "soumissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soumissions" ADD CONSTRAINT "soumissions_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conventions_fin_idx" ON "conventions" USING btree ("organization_id","fin");--> statement-breakpoint
CREATE INDEX "pieces_soumission_idx" ON "pieces_soumission" USING btree ("soumission_id","rang");--> statement-breakpoint
CREATE INDEX "soumissions_org_idx" ON "soumissions" USING btree ("organization_id","statut","date_limite");--> statement-breakpoint
ALTER TABLE "soumissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pieces_soumission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consultations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "offres" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conventions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "avenants" ENABLE ROW LEVEL SECURITY;