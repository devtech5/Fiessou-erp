CREATE TABLE "modeles_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"famille_id" uuid,
	"reference" text NOT NULL,
	"designation" text NOT NULL,
	"unite" "code_unite" DEFAULT 'piece' NOT NULL,
	"prix_vente" bigint DEFAULT 0 NOT NULL,
	"prix_achat" bigint DEFAULT 0 NOT NULL,
	"taux_tva" integer,
	"seuil_alerte" bigint DEFAULT 0 NOT NULL,
	"fournisseur_id" uuid,
	"axes" jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "modeles_article_reference_unique" UNIQUE("organization_id","reference"),
	CONSTRAINT "modeles_article_prix" CHECK ("modeles_article"."prix_vente" >= 0 AND "modeles_article"."prix_achat" >= 0)
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "modele_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "attributs" jsonb;--> statement-breakpoint
ALTER TABLE "modeles_article" ADD CONSTRAINT "modeles_article_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_article" ADD CONSTRAINT "modeles_article_famille_id_familles_article_id_fk" FOREIGN KEY ("famille_id") REFERENCES "public"."familles_article"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_article" ADD CONSTRAINT "modeles_article_fournisseur_id_tiers_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_modele_id_modeles_article_id_fk" FOREIGN KEY ("modele_id") REFERENCES "public"."modeles_article"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_modele_attributs_unique" ON "articles" USING btree ("modele_id","attributs") WHERE "articles"."modele_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "modeles_article" ENABLE ROW LEVEL SECURITY;