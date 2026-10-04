CREATE TYPE "public"."visibilite_dossier_archives" AS ENUM('tous', 'selection');--> statement-breakpoint
CREATE TABLE "acces_dossiers_archives" (
	"dossier_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "acces_dossiers_archives_dossier_id_user_id_pk" PRIMARY KEY("dossier_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dossiers_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"visibilite" "visibilite_dossier_archives" DEFAULT 'selection' NOT NULL,
	"depot_ouvert" boolean DEFAULT false NOT NULL,
	"cree_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "dossiers_archives_nom_unique" UNIQUE("organization_id","nom")
);
--> statement-breakpoint
ALTER TABLE "archives" ADD COLUMN "dossier_id" uuid;--> statement-breakpoint
ALTER TABLE "acces_dossiers_archives" ADD CONSTRAINT "acces_dossiers_archives_dossier_id_dossiers_archives_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers_archives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_dossiers_archives" ADD CONSTRAINT "acces_dossiers_archives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers_archives" ADD CONSTRAINT "dossiers_archives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acces_dossiers_archives_membre_idx" ON "acces_dossiers_archives" USING btree ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "archives" ADD CONSTRAINT "archives_dossier_id_dossiers_archives_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers_archives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archives_dossier_idx" ON "archives" USING btree ("dossier_id","created_at");--> statement-breakpoint
-- RLS dans la même migration que la création des tables.
ALTER TABLE "dossiers_archives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acces_dossiers_archives" ENABLE ROW LEVEL SECURITY;