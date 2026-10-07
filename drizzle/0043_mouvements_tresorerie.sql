CREATE TYPE "public"."nature_mouvement" AS ENUM('client', 'fournisseur', 'remboursement_client', 'apport', 'emprunt', 'remboursement_emprunt', 'frais_bancaires', 'produit_financier', 'autre_entree', 'autre_sortie');--> statement-breakpoint
CREATE TYPE "public"."statut_mouvement" AS ENUM('valide', 'annule');--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'mouvement';--> statement-breakpoint
CREATE TABLE "mouvements_tresorerie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"compte_id" uuid NOT NULL,
	"nature" "nature_mouvement" NOT NULL,
	"tiers_id" uuid,
	"tiers_nom" text,
	"montant" bigint NOT NULL,
	"date_operation" date NOT NULL,
	"libelle" text NOT NULL,
	"reference" text,
	"rib_beneficiaire" text,
	"statut" "statut_mouvement" DEFAULT 'valide' NOT NULL,
	"ecriture" text NOT NULL,
	"motif_annulation" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "mouvements_tresorerie_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "mouvements_tresorerie_montant" CHECK ("mouvements_tresorerie"."montant" > 0),
	CONSTRAINT "mouvements_tresorerie_annulation" CHECK ("mouvements_tresorerie"."statut" <> 'annule' OR "mouvements_tresorerie"."motif_annulation" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "mouvements_tresorerie" ADD CONSTRAINT "mouvements_tresorerie_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_tresorerie" ADD CONSTRAINT "mouvements_tresorerie_compte_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_tresorerie" ADD CONSTRAINT "mouvements_tresorerie_tiers_id_tiers_id_fk" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mouvements_tresorerie_compte_idx" ON "mouvements_tresorerie" USING btree ("organization_id","compte_id","date_operation");--> statement-breakpoint
ALTER TABLE "mouvements_tresorerie" ENABLE ROW LEVEL SECURITY;