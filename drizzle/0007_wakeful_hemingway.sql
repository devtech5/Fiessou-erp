CREATE TYPE "public"."statut_session_caisse" AS ENUM('ouverte', 'cloturee');--> statement-breakpoint
CREATE TABLE "comptages_caisse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"moyen" "moyen_reglement" NOT NULL,
	"attendu" bigint DEFAULT 0 NOT NULL,
	"compte" bigint DEFAULT 0 NOT NULL,
	"ecart" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions_caisse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"caisse_id" uuid NOT NULL,
	"user_id" uuid,
	"caissier" text NOT NULL,
	"statut" "statut_session_caisse" DEFAULT 'ouverte' NOT NULL,
	"fond_initial" bigint DEFAULT 0 NOT NULL,
	"ouverte_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cloturee_le" timestamp with time zone,
	"ecart" bigint DEFAULT 0 NOT NULL,
	"motif_ecart" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sessions_caisse_fond_positif" CHECK ("sessions_caisse"."fond_initial" >= 0),
	CONSTRAINT "sessions_caisse_cloture_datee" CHECK (("sessions_caisse"."statut" = 'ouverte' AND "sessions_caisse"."cloturee_le" IS NULL)
          OR ("sessions_caisse"."statut" = 'cloturee' AND "sessions_caisse"."cloturee_le" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "ventes" ADD COLUMN "session_caisse_id" uuid;--> statement-breakpoint
ALTER TABLE "comptages_caisse" ADD CONSTRAINT "comptages_caisse_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptages_caisse" ADD CONSTRAINT "comptages_caisse_session_id_sessions_caisse_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions_caisse"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions_caisse" ADD CONSTRAINT "sessions_caisse_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions_caisse" ADD CONSTRAINT "sessions_caisse_caisse_id_postes_caisse_id_fk" FOREIGN KEY ("caisse_id") REFERENCES "public"."postes_caisse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comptages_caisse_session_idx" ON "comptages_caisse" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "comptages_caisse_org_idx" ON "comptages_caisse" USING btree ("organization_id","moyen");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_caisse_ouverte_unique" ON "sessions_caisse" USING btree ("caisse_id") WHERE "sessions_caisse"."statut" = 'ouverte' AND "sessions_caisse"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sessions_caisse_org_idx" ON "sessions_caisse" USING btree ("organization_id","ouverte_le");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : Supabase expose
-- une API REST sur le schéma public, lisible avec la clé publiable. Une table
-- oubliée ici livre les comptages de caisse — donc les écarts, donc ce qu'un
-- caissier a manqué — de toutes les entreprises.
ALTER TABLE "sessions_caisse" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comptages_caisse" ENABLE ROW LEVEL SECURITY;
