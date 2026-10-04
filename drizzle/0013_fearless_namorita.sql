CREATE TYPE "public"."moyen_reglement_piece" AS ENUM('especes', 'mobile_money', 'banque');--> statement-breakpoint
CREATE TYPE "public"."nature_piece" AS ENUM('devis', 'facture', 'avoir');--> statement-breakpoint
CREATE TYPE "public"."statut_piece" AS ENUM('brouillon', 'emise', 'acceptee', 'refusee', 'convertie', 'annulee');--> statement-breakpoint
CREATE TABLE "lignes_piece" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"piece_id" uuid NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"article_id" uuid,
	"designation" text NOT NULL,
	"quantite" bigint NOT NULL,
	"unite" text DEFAULT 'piece' NOT NULL,
	"prix_unitaire_ht" bigint NOT NULL,
	"remise" bigint DEFAULT 0 NOT NULL,
	"montant_ht" bigint NOT NULL,
	"taux_tva" integer NOT NULL,
	"compte_vente" text DEFAULT '701' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lignes_piece_quantite_positive" CHECK ("lignes_piece"."quantite" > 0),
	CONSTRAINT "lignes_piece_montants_positifs" CHECK ("lignes_piece"."prix_unitaire_ht" >= 0 AND "lignes_piece"."remise" >= 0 AND "lignes_piece"."montant_ht" >= 0),
	CONSTRAINT "lignes_piece_taux_borne" CHECK ("lignes_piece"."taux_tva" >= 0 AND "lignes_piece"."taux_tva" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "pieces_commerciales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nature" "nature_piece" NOT NULL,
	"numero" text,
	"statut" "statut_piece" DEFAULT 'brouillon' NOT NULL,
	"client_id" uuid NOT NULL,
	"client_nom" text NOT NULL,
	"date_piece" date NOT NULL,
	"echeance" date,
	"depot_id" uuid,
	"origine_id" uuid,
	"total_ht" bigint DEFAULT 0 NOT NULL,
	"total_tva" bigint DEFAULT 0 NOT NULL,
	"total_ttc" bigint DEFAULT 0 NOT NULL,
	"ecriture_numero" text,
	"notes" text,
	"motif_annulation" text,
	"emise_le" timestamp with time zone,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pieces_commerciales_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "pieces_commerciales_totaux_positifs" CHECK ("pieces_commerciales"."total_ht" >= 0 AND "pieces_commerciales"."total_tva" >= 0 AND "pieces_commerciales"."total_ttc" >= 0),
	CONSTRAINT "pieces_commerciales_numero_emis" CHECK ("pieces_commerciales"."statut" = 'brouillon' OR "pieces_commerciales"."numero" IS NOT NULL),
	CONSTRAINT "pieces_commerciales_annulation_motivee" CHECK ("pieces_commerciales"."statut" <> 'annulee' OR "pieces_commerciales"."motif_annulation" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "reglements_piece" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"piece_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"date_reglement" date NOT NULL,
	"moyen" "moyen_reglement_piece" NOT NULL,
	"montant" bigint NOT NULL,
	"reference" text,
	"ecriture_numero" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reglements_piece_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "reglements_piece_montant_positif" CHECK ("reglements_piece"."montant" > 0)
);
--> statement-breakpoint
ALTER TABLE "lignes_piece" ADD CONSTRAINT "lignes_piece_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_piece" ADD CONSTRAINT "lignes_piece_piece_id_pieces_commerciales_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces_commerciales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_piece" ADD CONSTRAINT "lignes_piece_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD CONSTRAINT "pieces_commerciales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD CONSTRAINT "pieces_commerciales_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD CONSTRAINT "pieces_commerciales_depot_id_depots_id_fk" FOREIGN KEY ("depot_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_piece" ADD CONSTRAINT "reglements_piece_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_piece" ADD CONSTRAINT "reglements_piece_piece_id_pieces_commerciales_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces_commerciales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lignes_piece_piece_idx" ON "lignes_piece" USING btree ("piece_id","ordre");--> statement-breakpoint
CREATE INDEX "pieces_commerciales_org_idx" ON "pieces_commerciales" USING btree ("organization_id","nature","statut");--> statement-breakpoint
CREATE INDEX "pieces_commerciales_client_idx" ON "pieces_commerciales" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "pieces_commerciales_origine_idx" ON "pieces_commerciales" USING btree ("origine_id");--> statement-breakpoint
CREATE INDEX "reglements_piece_piece_idx" ON "reglements_piece" USING btree ("piece_id");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception : Supabase expose
-- une API REST sur le schéma public, lisible avec la clé publiable. Une table
-- oubliée ici livre les factures, les montants et les clients de toutes les
-- entreprises.
ALTER TABLE "pieces_commerciales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lignes_piece" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reglements_piece" ENABLE ROW LEVEL SECURITY;
