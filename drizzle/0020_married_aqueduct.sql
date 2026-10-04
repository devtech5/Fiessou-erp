CREATE TABLE "archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"user_id" uuid NOT NULL,
	"titre" text NOT NULL,
	"dossier" text,
	"description" text,
	"chemin" text NOT NULL,
	"nom_fichier" text NOT NULL,
	"type_mime" text NOT NULL,
	"taille_octets" bigint NOT NULL,
	"empreinte" char(64) NOT NULL,
	"retiree_le" timestamp with time zone,
	"motif_retrait" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "archives_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "archives_chemin_unique" UNIQUE("organization_id","chemin"),
	CONSTRAINT "archives_taille_positive" CHECK ("archives"."taille_octets" > 0),
	CONSTRAINT "archives_retrait_motive" CHECK ("archives"."retiree_le" IS NULL OR "archives"."motif_retrait" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "archives" ADD CONSTRAINT "archives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archives_titulaire_idx" ON "archives" USING btree ("organization_id","user_id","created_at");--> statement-breakpoint
-- Supabase expose le schéma public par son API REST : une table sans RLS y serait lisible.
ALTER TABLE "archives" ENABLE ROW LEVEL SECURITY;