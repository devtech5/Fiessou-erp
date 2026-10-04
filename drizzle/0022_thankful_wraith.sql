CREATE TYPE "public"."priorite_tache" AS ENUM('basse', 'normale', 'haute', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."statut_tache" AS ENUM('a_faire', 'en_cours', 'terminee', 'annulee');--> statement-breakpoint
CREATE TABLE "taches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"titre" text NOT NULL,
	"description" text,
	"priorite" "priorite_tache" DEFAULT 'normale' NOT NULL,
	"statut" "statut_tache" DEFAULT 'a_faire' NOT NULL,
	"echeance" date,
	"cree_par_user_id" uuid NOT NULL,
	"assignee_user_id" uuid NOT NULL,
	"attribuee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"demarree_le" timestamp with time zone,
	"terminee_le" timestamp with time zone,
	"terminee_par_user_id" uuid,
	"compte_rendu" text,
	"annulee_le" timestamp with time zone,
	"motif_annulation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "taches_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "taches_terminee_datee" CHECK ("taches"."statut" <> 'terminee' OR "taches"."terminee_le" IS NOT NULL),
	CONSTRAINT "taches_annulation_motivee" CHECK ("taches"."statut" <> 'annulee' OR "taches"."motif_annulation" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "taches_assignee_idx" ON "taches" USING btree ("organization_id","assignee_user_id","statut");--> statement-breakpoint
CREATE INDEX "taches_createur_idx" ON "taches" USING btree ("organization_id","cree_par_user_id");--> statement-breakpoint
-- RLS dans la même migration que la création de la table.
ALTER TABLE "taches" ENABLE ROW LEVEL SECURITY;