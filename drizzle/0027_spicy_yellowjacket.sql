CREATE TYPE "public"."moyen_paiement_abonnement" AS ENUM('wave', 'orange_money', 'mtn_money', 'moov_money', 'virement', 'especes', 'autre');--> statement-breakpoint
CREATE TABLE "paiements_abonnement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"montant" bigint NOT NULL,
	"mois" integer NOT NULL,
	"moyen" "moyen_paiement_abonnement" NOT NULL,
	"reference" text,
	"recu_le" date NOT NULL,
	"couvre_du" date NOT NULL,
	"couvre_au" date NOT NULL,
	"enregistre_par" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "paiements_abonnement_mois" CHECK ("paiements_abonnement"."mois" between -24 and 36 and "paiements_abonnement"."mois" <> 0)
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "paye_jusqu_au" date;--> statement-breakpoint
ALTER TABLE "paiements_abonnement" ADD CONSTRAINT "paiements_abonnement_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paiements_abonnement_org_idx" ON "paiements_abonnement" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "paiements_abonnement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Les entreprises déjà en essai, dont l'essai de 14 jours est souvent échu depuis
-- longtemps, reçoivent 30 jours à compter de la mise en service de l'abonnement.
UPDATE "organizations" SET "trial_ends_at" = now() + interval '30 days' WHERE "status" = 'essai' AND ("trial_ends_at" IS NULL OR "trial_ends_at" < now() + interval '30 days');
