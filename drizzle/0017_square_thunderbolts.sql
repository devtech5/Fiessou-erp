CREATE TYPE "public"."moyen_depense" AS ENUM('especes', 'mobile_money', 'banque');--> statement-breakpoint
CREATE TYPE "public"."nature_piece_projet" AS ENUM('photo', 'preuve_paiement', 'facture', 'autre');--> statement-breakpoint
CREATE TYPE "public"."statut_depense" AS ENUM('demandee', 'approuvee', 'payee', 'rejetee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."statut_projet" AS ENUM('preparation', 'en_cours', 'suspendu', 'termine', 'annule');--> statement-breakpoint
CREATE TABLE "depenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"projet_id" uuid,
	"objet" text NOT NULL,
	"categorie" text NOT NULL,
	"fournisseur_id" uuid,
	"fournisseur_libelle" text,
	"montant" bigint NOT NULL,
	"taux_tva" integer DEFAULT 0 NOT NULL,
	"statut" "statut_depense" DEFAULT 'demandee' NOT NULL,
	"demandee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"demandee_par_user_id" uuid,
	"approuvee_le" timestamp with time zone,
	"approuvee_par_user_id" uuid,
	"payee_le" timestamp with time zone,
	"payee_par_user_id" uuid,
	"moyen" "moyen_depense",
	"reference_paiement" text,
	"ecriture" text,
	"motif" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "depenses_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "depenses_montant" CHECK ("depenses"."montant" > 0 AND "depenses"."taux_tva" >= 0),
	CONSTRAINT "depenses_paiement_complet" CHECK ("depenses"."statut" <> 'payee' OR ("depenses"."payee_le" IS NOT NULL AND "depenses"."moyen" IS NOT NULL)),
	CONSTRAINT "depenses_refus_motive" CHECK ("depenses"."statut" NOT IN ('rejetee', 'annulee') OR "depenses"."motif" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "pieces_projet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"projet_id" uuid,
	"depense_id" uuid,
	"nature" "nature_piece_projet" NOT NULL,
	"legende" text,
	"chemin" text NOT NULL,
	"nom_fichier" text NOT NULL,
	"type_mime" text NOT NULL,
	"taille_octets" bigint NOT NULL,
	"depose_par_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pieces_projet_chemin_unique" UNIQUE("organization_id","chemin"),
	CONSTRAINT "pieces_projet_rattachee" CHECK ("pieces_projet"."projet_id" IS NOT NULL OR "pieces_projet"."depense_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "projets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"client_id" uuid,
	"responsable_user_id" uuid,
	"budget" bigint,
	"debut" date,
	"fin" date,
	"statut" "statut_projet" DEFAULT 'preparation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "projets_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "projets_budget" CHECK ("projets"."budget" IS NULL OR "projets"."budget" >= 0),
	CONSTRAINT "projets_periode" CHECK ("projets"."fin" IS NULL OR "projets"."debut" IS NULL OR "projets"."fin" >= "projets"."debut")
);
--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_projet_id_projets_id_fk" FOREIGN KEY ("projet_id") REFERENCES "public"."projets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_fournisseur_id_tiers_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_projet" ADD CONSTRAINT "pieces_projet_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_projet" ADD CONSTRAINT "pieces_projet_projet_id_projets_id_fk" FOREIGN KEY ("projet_id") REFERENCES "public"."projets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_projet" ADD CONSTRAINT "pieces_projet_depense_id_depenses_id_fk" FOREIGN KEY ("depense_id") REFERENCES "public"."depenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_client_id_tiers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "depenses_projet_idx" ON "depenses" USING btree ("projet_id");--> statement-breakpoint
CREATE INDEX "depenses_org_idx" ON "depenses" USING btree ("organization_id","statut");--> statement-breakpoint
CREATE INDEX "pieces_projet_projet_idx" ON "pieces_projet" USING btree ("projet_id");--> statement-breakpoint
CREATE INDEX "pieces_projet_depense_idx" ON "pieces_projet" USING btree ("depense_id");--> statement-breakpoint
CREATE INDEX "projets_org_idx" ON "projets" USING btree ("organization_id","statut");--> statement-breakpoint
-- RLS dans la MÊME migration que la création : les dépenses, leurs montants
-- et les photos de chantier ne se lisent pas par l'API publique.
ALTER TABLE "projets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "depenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pieces_projet" ENABLE ROW LEVEL SECURITY;
