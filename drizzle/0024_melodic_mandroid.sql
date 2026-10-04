CREATE TYPE "public"."statut_commande_achat" AS ENUM('brouillon', 'envoyee', 'partielle', 'recue', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."statut_facture_fournisseur" AS ENUM('comptabilisee', 'annulee');--> statement-breakpoint
CREATE TABLE "commandes_achat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"fournisseur_id" uuid NOT NULL,
	"fournisseur_nom" text NOT NULL,
	"depot_id" uuid,
	"date_commande" date NOT NULL,
	"livraison_prevue" date,
	"statut" "statut_commande_achat" DEFAULT 'brouillon' NOT NULL,
	"total_ht" bigint DEFAULT 0 NOT NULL,
	"total_tva" bigint DEFAULT 0 NOT NULL,
	"total_ttc" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"cree_par_user_id" uuid,
	"envoyee_le" timestamp with time zone,
	"motif_annulation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "commandes_achat_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "commandes_achat_totaux" CHECK ("commandes_achat"."total_ht" >= 0 AND "commandes_achat"."total_tva" >= 0 AND "commandes_achat"."total_ttc" = "commandes_achat"."total_ht" + "commandes_achat"."total_tva"),
	CONSTRAINT "commandes_achat_annulation_motivee" CHECK ("commandes_achat"."statut" <> 'annulee' OR "commandes_achat"."motif_annulation" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "factures_fournisseur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"reference_fournisseur" text NOT NULL,
	"fournisseur_id" uuid NOT NULL,
	"fournisseur_nom" text NOT NULL,
	"commande_id" uuid,
	"date_facture" date NOT NULL,
	"echeance" date NOT NULL,
	"total_ht" bigint NOT NULL,
	"total_tva" bigint NOT NULL,
	"total_ttc" bigint NOT NULL,
	"statut" "statut_facture_fournisseur" DEFAULT 'comptabilisee' NOT NULL,
	"ecriture" text NOT NULL,
	"justificatif_chemin" text,
	"justificatif_nom" text,
	"notes" text,
	"user_id" uuid NOT NULL,
	"motif_annulation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "factures_fournisseur_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "factures_fournisseur_reference_unique" UNIQUE("organization_id","fournisseur_id","reference_fournisseur"),
	CONSTRAINT "factures_fournisseur_totaux" CHECK ("factures_fournisseur"."total_ttc" = "factures_fournisseur"."total_ht" + "factures_fournisseur"."total_tva" AND "factures_fournisseur"."total_ttc" > 0),
	CONSTRAINT "factures_fournisseur_echeance" CHECK ("factures_fournisseur"."echeance" >= "factures_fournisseur"."date_facture")
);
--> statement-breakpoint
CREATE TABLE "lignes_commande_achat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"commande_id" uuid NOT NULL,
	"article_id" uuid,
	"designation" text NOT NULL,
	"quantite" bigint NOT NULL,
	"prix_unitaire_ht" bigint NOT NULL,
	"taux_tva" integer DEFAULT 1800 NOT NULL,
	"compte_achat" text DEFAULT '601' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lignes_commande_achat_valeurs" CHECK ("lignes_commande_achat"."quantite" > 0 AND "lignes_commande_achat"."prix_unitaire_ht" >= 0 AND "lignes_commande_achat"."taux_tva" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lignes_facture_fournisseur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"facture_id" uuid NOT NULL,
	"ligne_commande_id" uuid,
	"designation" text NOT NULL,
	"quantite" bigint NOT NULL,
	"prix_unitaire_ht" bigint NOT NULL,
	"taux_tva" integer NOT NULL,
	"compte_achat" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lignes_facture_fournisseur_valeurs" CHECK ("lignes_facture_fournisseur"."quantite" > 0 AND "lignes_facture_fournisseur"."prix_unitaire_ht" >= 0 AND "lignes_facture_fournisseur"."taux_tva" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lignes_reception_achat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reception_id" uuid NOT NULL,
	"ligne_commande_id" uuid NOT NULL,
	"quantite" bigint NOT NULL,
	"mouvement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lignes_reception_achat_quantite" CHECK ("lignes_reception_achat"."quantite" > 0)
);
--> statement-breakpoint
CREATE TABLE "receptions_achat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"commande_id" uuid NOT NULL,
	"depot_id" uuid NOT NULL,
	"date_reception" date NOT NULL,
	"bordereau" text,
	"notes" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "receptions_achat_numero_unique" UNIQUE("organization_id","numero")
);
--> statement-breakpoint
CREATE TABLE "reglements_fournisseur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"facture_id" uuid NOT NULL,
	"compte_tresorerie_id" uuid NOT NULL,
	"montant" bigint NOT NULL,
	"date_reglement" date NOT NULL,
	"reference" text,
	"ecriture" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reglements_fournisseur_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "reglements_fournisseur_montant" CHECK ("reglements_fournisseur"."montant" > 0)
);
--> statement-breakpoint
ALTER TABLE "commandes_achat" ADD CONSTRAINT "commandes_achat_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_achat" ADD CONSTRAINT "commandes_achat_fournisseur_id_tiers_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_achat" ADD CONSTRAINT "commandes_achat_depot_id_depots_id_fk" FOREIGN KEY ("depot_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_fournisseur_id_tiers_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_commande_id_commandes_achat_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes_achat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande_achat" ADD CONSTRAINT "lignes_commande_achat_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande_achat" ADD CONSTRAINT "lignes_commande_achat_commande_id_commandes_achat_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes_achat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_commande_achat" ADD CONSTRAINT "lignes_commande_achat_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_facture_fournisseur" ADD CONSTRAINT "lignes_facture_fournisseur_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_facture_fournisseur" ADD CONSTRAINT "lignes_facture_fournisseur_facture_id_factures_fournisseur_id_fk" FOREIGN KEY ("facture_id") REFERENCES "public"."factures_fournisseur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_facture_fournisseur" ADD CONSTRAINT "lignes_facture_fournisseur_ligne_commande_id_lignes_commande_achat_id_fk" FOREIGN KEY ("ligne_commande_id") REFERENCES "public"."lignes_commande_achat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_reception_achat" ADD CONSTRAINT "lignes_reception_achat_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_reception_achat" ADD CONSTRAINT "lignes_reception_achat_reception_id_receptions_achat_id_fk" FOREIGN KEY ("reception_id") REFERENCES "public"."receptions_achat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_reception_achat" ADD CONSTRAINT "lignes_reception_achat_ligne_commande_id_lignes_commande_achat_id_fk" FOREIGN KEY ("ligne_commande_id") REFERENCES "public"."lignes_commande_achat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptions_achat" ADD CONSTRAINT "receptions_achat_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptions_achat" ADD CONSTRAINT "receptions_achat_commande_id_commandes_achat_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes_achat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptions_achat" ADD CONSTRAINT "receptions_achat_depot_id_depots_id_fk" FOREIGN KEY ("depot_id") REFERENCES "public"."depots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_fournisseur" ADD CONSTRAINT "reglements_fournisseur_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_fournisseur" ADD CONSTRAINT "reglements_fournisseur_facture_id_factures_fournisseur_id_fk" FOREIGN KEY ("facture_id") REFERENCES "public"."factures_fournisseur"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements_fournisseur" ADD CONSTRAINT "reglements_fournisseur_compte_tresorerie_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_tresorerie_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commandes_achat_statut_idx" ON "commandes_achat" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "commandes_achat_fournisseur_idx" ON "commandes_achat" USING btree ("organization_id","fournisseur_id");--> statement-breakpoint
CREATE INDEX "factures_fournisseur_echeance_idx" ON "factures_fournisseur" USING btree ("organization_id","echeance");--> statement-breakpoint
CREATE INDEX "lignes_commande_achat_idx" ON "lignes_commande_achat" USING btree ("commande_id","ordre");--> statement-breakpoint
CREATE INDEX "lignes_facture_fournisseur_idx" ON "lignes_facture_fournisseur" USING btree ("facture_id");--> statement-breakpoint
CREATE INDEX "lignes_reception_achat_ligne_idx" ON "lignes_reception_achat" USING btree ("ligne_commande_id");--> statement-breakpoint
CREATE INDEX "receptions_achat_commande_idx" ON "receptions_achat" USING btree ("commande_id");--> statement-breakpoint
CREATE INDEX "reglements_fournisseur_facture_idx" ON "reglements_fournisseur" USING btree ("facture_id");--> statement-breakpoint
-- RLS dans la même migration que la création des tables.
ALTER TABLE "commandes_achat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lignes_commande_achat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receptions_achat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lignes_reception_achat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "factures_fournisseur" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lignes_facture_fournisseur" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reglements_fournisseur" ENABLE ROW LEVEL SECURITY;