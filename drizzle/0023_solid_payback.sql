CREATE TYPE "public"."nature_bon_caisse" AS ENUM('fournitures', 'carburant', 'transport', 'mission', 'entretien', 'telecom', 'reception', 'divers');--> statement-breakpoint
CREATE TYPE "public"."nature_compte_tresorerie" AS ENUM('caisse', 'banque', 'mobile_money');--> statement-breakpoint
CREATE TYPE "public"."statut_avance" AS ENUM('ouverte', 'soldee');--> statement-breakpoint
CREATE TYPE "public"."statut_bon_caisse" AS ENUM('demande', 'approuve', 'rejete', 'decaisse', 'annule');--> statement-breakpoint
CREATE TYPE "public"."statut_virement" AS ENUM('en_transit', 'recu', 'annule');--> statement-breakpoint
CREATE TYPE "public"."type_regularisation" AS ENUM('justification', 'remboursement');--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'virement';--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'avance';--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'arrete_caisse';--> statement-breakpoint
ALTER TYPE "public"."origine_piece" ADD VALUE 'releve';--> statement-breakpoint
CREATE TABLE "arretes_caisse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"compte_id" uuid NOT NULL,
	"date_arrete" date NOT NULL,
	"theorique" bigint NOT NULL,
	"compte_constate" bigint NOT NULL,
	"ecart" bigint NOT NULL,
	"ecriture" text,
	"observations" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "arretes_caisse_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "arretes_caisse_ecart" CHECK ("arretes_caisse"."ecart" = "arretes_caisse"."compte_constate" - "arretes_caisse"."theorique")
);
--> statement-breakpoint
CREATE TABLE "avances_tresorerie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"caisse_id" uuid NOT NULL,
	"beneficiaire_user_id" uuid,
	"beneficiaire" text NOT NULL,
	"montant" bigint NOT NULL,
	"motif" text NOT NULL,
	"echeance" date,
	"statut" "statut_avance" DEFAULT 'ouverte' NOT NULL,
	"ecriture" text NOT NULL,
	"remise_par_user_id" uuid NOT NULL,
	"soldee_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "avances_tresorerie_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "avances_tresorerie_montant" CHECK ("avances_tresorerie"."montant" > 0)
);
--> statement-breakpoint
CREATE TABLE "bons_caisse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"caisse_id" uuid NOT NULL,
	"nature" "nature_bon_caisse" NOT NULL,
	"montant" bigint NOT NULL,
	"beneficiaire" text NOT NULL,
	"motif" text NOT NULL,
	"statut" "statut_bon_caisse" DEFAULT 'demande' NOT NULL,
	"demande_par_user_id" uuid NOT NULL,
	"approuve_par_user_id" uuid,
	"approuve_le" timestamp with time zone,
	"motif_rejet" text,
	"decaisse_par_user_id" uuid,
	"decaisse_le" timestamp with time zone,
	"ecriture" text,
	"justificatif_chemin" text,
	"justificatif_nom" text,
	"justificatif_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bons_caisse_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "bons_caisse_montant" CHECK ("bons_caisse"."montant" > 0),
	CONSTRAINT "bons_caisse_rejet_motive" CHECK ("bons_caisse"."statut" <> 'rejete' OR "bons_caisse"."motif_rejet" IS NOT NULL),
	CONSTRAINT "bons_caisse_decaisse_ecrit" CHECK ("bons_caisse"."statut" <> 'decaisse' OR "bons_caisse"."ecriture" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "comptes_tresorerie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"nature" "nature_compte_tresorerie" NOT NULL,
	"compte" text NOT NULL,
	"etablissement" text,
	"reference" text,
	"responsable_user_id" uuid,
	"seuil_alerte" bigint DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "comptes_tresorerie_compte_unique" UNIQUE("organization_id","compte"),
	CONSTRAINT "comptes_tresorerie_nom_unique" UNIQUE("organization_id","nom"),
	CONSTRAINT "comptes_tresorerie_classe5" CHECK ("comptes_tresorerie"."compte" ~ '^5[2357][0-9]{0,4}$'),
	CONSTRAINT "comptes_tresorerie_seuil" CHECK ("comptes_tresorerie"."seuil_alerte" >= 0)
);
--> statement-breakpoint
CREATE TABLE "imports_releve" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"compte_id" uuid NOT NULL,
	"nom_fichier" text NOT NULL,
	"lignes" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lignes_releve" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"compte_id" uuid NOT NULL,
	"date_operation" date NOT NULL,
	"libelle" text NOT NULL,
	"montant" bigint NOT NULL,
	"ligne_ecriture_id" uuid,
	"pointee_le" timestamp with time zone,
	"pointee_par_user_id" uuid,
	"ecriture" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lignes_releve_montant" CHECK ("lignes_releve"."montant" <> 0)
);
--> statement-breakpoint
CREATE TABLE "regularisations_avance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"avance_id" uuid NOT NULL,
	"type" "type_regularisation" NOT NULL,
	"montant" bigint NOT NULL,
	"nature" "nature_bon_caisse",
	"caisse_id" uuid,
	"libelle" text,
	"ecriture" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "regularisations_avance_montant" CHECK ("regularisations_avance"."montant" > 0),
	CONSTRAINT "regularisations_avance_complete" CHECK (("regularisations_avance"."type" = 'justification' AND "regularisations_avance"."nature" IS NOT NULL) OR ("regularisations_avance"."type" = 'remboursement' AND "regularisations_avance"."caisse_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "virements_internes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"source_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"montant" bigint NOT NULL,
	"frais" bigint DEFAULT 0 NOT NULL,
	"date_envoi" date NOT NULL,
	"reference" text,
	"motif" text,
	"statut" "statut_virement" DEFAULT 'en_transit' NOT NULL,
	"ecriture_envoi" text,
	"envoye_par_user_id" uuid NOT NULL,
	"date_reception" date,
	"ecriture_reception" text,
	"recu_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "virements_internes_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "virements_internes_montant" CHECK ("virements_internes"."montant" > 0 AND "virements_internes"."frais" >= 0),
	CONSTRAINT "virements_internes_distincts" CHECK ("virements_internes"."source_id" <> "virements_internes"."destination_id"),
	CONSTRAINT "virements_internes_recu_date" CHECK ("virements_internes"."statut" <> 'recu' OR "virements_internes"."date_reception" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_compte_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avances_tresorerie" ADD CONSTRAINT "avances_tresorerie_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avances_tresorerie" ADD CONSTRAINT "avances_tresorerie_caisse_id_comptes_tresorerie_id_fk" FOREIGN KEY ("caisse_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bons_caisse" ADD CONSTRAINT "bons_caisse_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bons_caisse" ADD CONSTRAINT "bons_caisse_caisse_id_comptes_tresorerie_id_fk" FOREIGN KEY ("caisse_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptes_tresorerie" ADD CONSTRAINT "comptes_tresorerie_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports_releve" ADD CONSTRAINT "imports_releve_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports_releve" ADD CONSTRAINT "imports_releve_compte_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_releve" ADD CONSTRAINT "lignes_releve_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_releve" ADD CONSTRAINT "lignes_releve_import_id_imports_releve_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports_releve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_releve" ADD CONSTRAINT "lignes_releve_compte_id_comptes_tresorerie_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regularisations_avance" ADD CONSTRAINT "regularisations_avance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regularisations_avance" ADD CONSTRAINT "regularisations_avance_avance_id_avances_tresorerie_id_fk" FOREIGN KEY ("avance_id") REFERENCES "public"."avances_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regularisations_avance" ADD CONSTRAINT "regularisations_avance_caisse_id_comptes_tresorerie_id_fk" FOREIGN KEY ("caisse_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virements_internes" ADD CONSTRAINT "virements_internes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virements_internes" ADD CONSTRAINT "virements_internes_source_id_comptes_tresorerie_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virements_internes" ADD CONSTRAINT "virements_internes_destination_id_comptes_tresorerie_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."comptes_tresorerie"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arretes_caisse_compte_idx" ON "arretes_caisse" USING btree ("compte_id","date_arrete");--> statement-breakpoint
CREATE INDEX "avances_tresorerie_statut_idx" ON "avances_tresorerie" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "bons_caisse_statut_idx" ON "bons_caisse" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE UNIQUE INDEX "lignes_releve_ecriture_unique" ON "lignes_releve" USING btree ("organization_id","ligne_ecriture_id") WHERE "lignes_releve"."ligne_ecriture_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "lignes_releve_compte_idx" ON "lignes_releve" USING btree ("compte_id","date_operation");--> statement-breakpoint
CREATE INDEX "regularisations_avance_idx" ON "regularisations_avance" USING btree ("avance_id");--> statement-breakpoint
CREATE INDEX "virements_internes_statut_idx" ON "virements_internes" USING btree ("organization_id","statut");--> statement-breakpoint
-- RLS dans la même migration que la création des tables.
ALTER TABLE "comptes_tresorerie" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "virements_internes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bons_caisse" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "avances_tresorerie" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "regularisations_avance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "arretes_caisse" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "imports_releve" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lignes_releve" ENABLE ROW LEVEL SECURITY;