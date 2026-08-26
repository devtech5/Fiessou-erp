CREATE TYPE "public"."statut_signature" AS ENUM('brouillon', 'envoyee', 'partielle', 'signee', 'expiree', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."type_entite_document" AS ENUM('tiers', 'employe', 'intervenant', 'actif', 'article', 'vente', 'ecriture', 'contrat', 'mission', 'organisation');--> statement-breakpoint
CREATE TYPE "public"."visibilite_document" AS ENUM('prive', 'restreint', 'equipe');--> statement-breakpoint
CREATE TABLE "demandes_signature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"document_id" uuid NOT NULL,
	"statut" "statut_signature" DEFAULT 'brouillon' NOT NULL,
	"code_securite" boolean DEFAULT false NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"signee_le" timestamp with time zone,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "demandes_signature_reference_unique" UNIQUE("organization_id","reference")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"categorie" text,
	"entite_type" "type_entite_document",
	"entite_id" uuid,
	"entite_libelle" text,
	"visibilite" "visibilite_document" DEFAULT 'equipe' NOT NULL,
	"chemin" text,
	"nom_fichier" text,
	"type_mime" text,
	"taille_octets" bigint,
	"expire_le" date,
	"notes" text,
	"depose_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "documents_chemin_unique" UNIQUE("organization_id","chemin"),
	CONSTRAINT "documents_rattachement_complet" CHECK (("documents"."entite_type" IS NULL AND "documents"."entite_id" IS NULL)
          OR ("documents"."entite_type" IS NOT NULL AND "documents"."entite_id" IS NOT NULL)),
	CONSTRAINT "documents_taille_positive" CHECK ("documents"."taille_octets" IS NULL OR "documents"."taille_octets" > 0)
);
--> statement-breakpoint
CREATE TABLE "signataires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"demande_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"interne" boolean DEFAULT false NOT NULL,
	"telephone" text,
	"email" text,
	"ordre" bigint DEFAULT 0 NOT NULL,
	"signe_le" timestamp with time zone,
	"signe_depuis" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demandes_signature" ADD CONSTRAINT "demandes_signature_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_signature" ADD CONSTRAINT "demandes_signature_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signataires" ADD CONSTRAINT "signataires_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signataires" ADD CONSTRAINT "signataires_demande_id_demandes_signature_id_fk" FOREIGN KEY ("demande_id") REFERENCES "public"."demandes_signature"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demandes_signature_statut_idx" ON "demandes_signature" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "demandes_signature_document_idx" ON "demandes_signature" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_entite_idx" ON "documents" USING btree ("organization_id","entite_type","entite_id");--> statement-breakpoint
CREATE INDEX "documents_expiration_idx" ON "documents" USING btree ("organization_id","expire_le");--> statement-breakpoint
CREATE INDEX "signataires_demande_idx" ON "signataires" USING btree ("demande_id","ordre");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : Supabase expose
-- une API REST sur le schéma public, lisible avec la clé publiable. Une table
-- oubliée ici livre les contrats de travail, les pièces d'identité et les
-- chemins des fichiers de toutes les entreprises.
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "demandes_signature" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "signataires" ENABLE ROW LEVEL SECURITY;
