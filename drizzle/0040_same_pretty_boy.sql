CREATE TABLE "comptes_courriel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"adresse" text NOT NULL,
	"nom_affiche" text,
	"imap_hote" text NOT NULL,
	"imap_port" integer NOT NULL,
	"imap_securise" boolean DEFAULT true NOT NULL,
	"smtp_hote" text NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_securise" boolean DEFAULT true NOT NULL,
	"identifiant" text NOT NULL,
	"mot_de_passe_chiffre" text NOT NULL,
	"signature" text,
	"verifie_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "comptes_courriel_utilisateur" UNIQUE("organization_id","user_id"),
	CONSTRAINT "comptes_courriel_ports" CHECK ("comptes_courriel"."imap_port" BETWEEN 1 AND 65535 AND "comptes_courriel"."smtp_port" BETWEEN 1 AND 65535)
);
--> statement-breakpoint
ALTER TABLE "comptes_courriel" ADD CONSTRAINT "comptes_courriel_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptes_courriel" ADD CONSTRAINT "comptes_courriel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptes_courriel" ENABLE ROW LEVEL SECURITY;