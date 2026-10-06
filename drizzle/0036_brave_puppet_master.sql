CREATE TYPE "public"."canal_envoi" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."public_campagne" AS ENUM('personnel', 'clients');--> statement-breakpoint
CREATE TYPE "public"."statut_campagne" AS ENUM('brouillon', 'envoyee');--> statement-breakpoint
CREATE TYPE "public"."statut_envoi" AS ENUM('en_attente', 'envoye', 'echec', 'ignore');--> statement-breakpoint
CREATE TABLE "campagnes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text,
	"titre" text NOT NULL,
	"public" "public_campagne" NOT NULL,
	"canaux" text[] NOT NULL,
	"filtre" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"objet" text,
	"corps" text NOT NULL,
	"statut" "statut_campagne" DEFAULT 'brouillon' NOT NULL,
	"destinataires" integer DEFAULT 0 NOT NULL,
	"envoyes" integer DEFAULT 0 NOT NULL,
	"echecs" integer DEFAULT 0 NOT NULL,
	"ignores" integer DEFAULT 0 NOT NULL,
	"envoyee_le" timestamp with time zone,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "campagnes_canaux" CHECK (cardinality("campagnes"."canaux") > 0)
);
--> statement-breakpoint
CREATE TABLE "desinscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canal" "canal_envoi" NOT NULL,
	"adresse" text NOT NULL,
	"origine" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "desinscriptions_unique" UNIQUE("organization_id","canal","adresse")
);
--> statement-breakpoint
CREATE TABLE "envois" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canal" "canal_envoi" NOT NULL,
	"destinataire" text NOT NULL,
	"nom" text,
	"tiers_id" uuid,
	"employe_id" uuid,
	"objet" text,
	"corps" text NOT NULL,
	"origine" text NOT NULL,
	"campagne_id" uuid,
	"statut" "statut_envoi" DEFAULT 'en_attente' NOT NULL,
	"raison" text,
	"envoye_le" timestamp with time zone,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"categorie" text NOT NULL,
	"titre" text NOT NULL,
	"corps" text,
	"lien" text,
	"lue_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campagnes" ADD CONSTRAINT "campagnes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desinscriptions" ADD CONSTRAINT "desinscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envois" ADD CONSTRAINT "envois_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campagnes_org_idx" ON "campagnes" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "envois_org_date_idx" ON "envois" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "envois_campagne_idx" ON "envois" USING btree ("campagne_id");--> statement-breakpoint
CREATE INDEX "envois_tiers_idx" ON "envois" USING btree ("organization_id","tiers_id");--> statement-breakpoint
CREATE INDEX "notifications_destinataire_idx" ON "notifications" USING btree ("organization_id","user_id","lue_le","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "envois" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "desinscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campagnes" ENABLE ROW LEVEL SECURITY;