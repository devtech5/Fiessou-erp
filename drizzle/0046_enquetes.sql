CREATE TYPE "public"."canal_reponse" AS ENUM('terrain', 'lien');--> statement-breakpoint
CREATE TYPE "public"."statut_enquete" AS ENUM('brouillon', 'ouverte', 'close');--> statement-breakpoint
CREATE TABLE "enquetes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"titre" text NOT NULL,
	"introduction" text,
	"projet_id" uuid,
	"questions" jsonb NOT NULL,
	"statut" "statut_enquete" DEFAULT 'brouillon' NOT NULL,
	"lien_public" boolean DEFAULT true NOT NULL,
	"objectif" integer,
	"ouverte_le" timestamp with time zone,
	"close_le" timestamp with time zone,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "enquetes_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "enquetes_questions_tableau" CHECK (jsonb_typeof("enquetes"."questions") = 'array'),
	CONSTRAINT "enquetes_objectif" CHECK ("enquetes"."objectif" IS NULL OR "enquetes"."objectif" BETWEEN 1 AND 1000000)
);
--> statement-breakpoint
CREATE TABLE "reponses_enquete" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enquete_id" uuid NOT NULL,
	"canal" "canal_reponse" NOT NULL,
	"valeurs" jsonb NOT NULL,
	"repondant" text,
	"user_id" uuid,
	"mission_id" uuid,
	"latitude_micro" integer,
	"longitude_micro" integer,
	"prise_le" timestamp with time zone NOT NULL,
	"recue_le" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reponses_enquete_valeurs_objet" CHECK (jsonb_typeof("reponses_enquete"."valeurs") = 'object'),
	CONSTRAINT "reponses_enquete_position_bornee" CHECK (("reponses_enquete"."latitude_micro" IS NULL OR "reponses_enquete"."latitude_micro" BETWEEN -90000000 AND 90000000)
        AND ("reponses_enquete"."longitude_micro" IS NULL OR "reponses_enquete"."longitude_micro" BETWEEN -180000000 AND 180000000))
);
--> statement-breakpoint
ALTER TABLE "enquetes" ADD CONSTRAINT "enquetes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquetes" ADD CONSTRAINT "enquetes_projet_id_projets_id_fk" FOREIGN KEY ("projet_id") REFERENCES "public"."projets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponses_enquete" ADD CONSTRAINT "reponses_enquete_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponses_enquete" ADD CONSTRAINT "reponses_enquete_enquete_id_enquetes_id_fk" FOREIGN KEY ("enquete_id") REFERENCES "public"."enquetes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponses_enquete" ADD CONSTRAINT "reponses_enquete_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquetes_org_idx" ON "enquetes" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "enquetes_projet_idx" ON "enquetes" USING btree ("projet_id");--> statement-breakpoint
CREATE INDEX "reponses_enquete_enquete_idx" ON "reponses_enquete" USING btree ("enquete_id","prise_le");--> statement-breakpoint
CREATE INDEX "reponses_enquete_org_idx" ON "reponses_enquete" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "enquetes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reponses_enquete" ENABLE ROW LEVEL SECURITY;