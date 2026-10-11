CREATE TYPE "public"."marque_enregistreur" AS ENUM('hikvision', 'dahua');--> statement-breakpoint
CREATE TYPE "public"."nature_site_securite" AS ENUM('magasin', 'entrepot', 'bureau', 'autre');--> statement-breakpoint
CREATE TABLE "cameras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"emplacement" text,
	"canal" integer NOT NULL,
	"hd" boolean DEFAULT false NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "cameras_canal_unique" UNIQUE("site_id","canal"),
	CONSTRAINT "cameras_canal" CHECK ("cameras"."canal" BETWEEN 1 AND 256)
);
--> statement-breakpoint
CREATE TABLE "sites_securite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"nature" "nature_site_securite" DEFAULT 'magasin' NOT NULL,
	"adresse" text,
	"marque" "marque_enregistreur" DEFAULT 'hikvision' NOT NULL,
	"enregistreur_adresse" text NOT NULL,
	"enregistreur_port" integer DEFAULT 554 NOT NULL,
	"relais_empreinte" text,
	"relais_vu_le" timestamp with time zone,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sites_securite_nom_unique" UNIQUE("organization_id","nom"),
	CONSTRAINT "sites_securite_port" CHECK ("sites_securite"."enregistreur_port" BETWEEN 1 AND 65535)
);
--> statement-breakpoint
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_site_id_sites_securite_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites_securite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites_securite" ADD CONSTRAINT "sites_securite_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cameras_site_idx" ON "cameras" USING btree ("organization_id","site_id","ordre");--> statement-breakpoint
CREATE INDEX "sites_securite_org_idx" ON "sites_securite" USING btree ("organization_id","actif");--> statement-breakpoint
ALTER TABLE "sites_securite" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cameras" ENABLE ROW LEVEL SECURITY;