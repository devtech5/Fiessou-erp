CREATE TYPE "public"."energie_vehicule" AS ENUM('essence', 'gasoil', 'hybride', 'electrique', 'gpl');--> statement-breakpoint
CREATE TYPE "public"."categorie_equipement" AS ENUM('portable', 'fixe', 'serveur', 'ecran', 'imprimante', 'reseau', 'telephone', 'tablette', 'onduleur', 'peripherique', 'autre');--> statement-breakpoint
CREATE TYPE "public"."type_licence" AS ENUM('abonnement', 'perpetuelle');--> statement-breakpoint
ALTER TYPE "public"."nature_echeance" ADD VALUE 'vignette';--> statement-breakpoint
ALTER TYPE "public"."nature_echeance" ADD VALUE 'patente';--> statement-breakpoint
CREATE TABLE "pleins_carburant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actif_id" uuid NOT NULL,
	"fait_le" timestamp with time zone DEFAULT now() NOT NULL,
	"volume" bigint NOT NULL,
	"montant" bigint NOT NULL,
	"kilometrage" bigint,
	"complet" boolean DEFAULT true NOT NULL,
	"station" text,
	"conducteur_id" uuid,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pleins_volume_positif" CHECK ("pleins_carburant"."volume" > 0),
	CONSTRAINT "pleins_montant_positif" CHECK ("pleins_carburant"."montant" >= 0),
	CONSTRAINT "pleins_kilometrage_positif" CHECK ("pleins_carburant"."kilometrage" IS NULL OR "pleins_carburant"."kilometrage" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehicules" (
	"actif_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"immatriculation" text NOT NULL,
	"marque" text,
	"modele" text,
	"annee" integer,
	"energie" "energie_vehicule",
	"numero_chassis" text,
	"numero_carte_grise" text,
	"puissance_fiscale" integer,
	"places" integer,
	"couleur" text,
	"reservoir_litres" integer,
	"usage" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "vehicules_immatriculation_unique" UNIQUE("organization_id","immatriculation"),
	CONSTRAINT "vehicules_annee" CHECK ("vehicules"."annee" IS NULL OR "vehicules"."annee" BETWEEN 1950 AND 2100),
	CONSTRAINT "vehicules_places" CHECK ("vehicules"."places" IS NULL OR "vehicules"."places" BETWEEN 1 AND 100),
	CONSTRAINT "vehicules_reservoir" CHECK ("vehicules"."reservoir_litres" IS NULL OR "vehicules"."reservoir_litres" BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "equipements_informatiques" (
	"actif_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"categorie" "categorie_equipement" DEFAULT 'portable' NOT NULL,
	"marque" text,
	"modele" text,
	"numero_serie" text,
	"systeme" text,
	"processeur" text,
	"memoire_go" integer,
	"stockage_go" integer,
	"nom_reseau" text,
	"adresse_ip" text,
	"adresse_mac" text,
	"accessoires" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "equipements_numero_serie_unique" UNIQUE("organization_id","numero_serie"),
	CONSTRAINT "equipements_memoire" CHECK ("equipements_informatiques"."memoire_go" IS NULL OR "equipements_informatiques"."memoire_go" BETWEEN 0 AND 100000),
	CONSTRAINT "equipements_stockage" CHECK ("equipements_informatiques"."stockage_go" IS NULL OR "equipements_informatiques"."stockage_go" BETWEEN 0 AND 10000000)
);
--> statement-breakpoint
CREATE TABLE "licences_attribuees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"licence_id" uuid NOT NULL,
	"actif_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "licences_attribuees_unique" UNIQUE("licence_id","actif_id")
);
--> statement-breakpoint
CREATE TABLE "licences_logicielles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"logiciel" text NOT NULL,
	"editeur" text,
	"type" "type_licence" DEFAULT 'abonnement' NOT NULL,
	"cle" text,
	"postes" integer DEFAULT 1 NOT NULL,
	"expire_le" date,
	"cout" bigint DEFAULT 0 NOT NULL,
	"fournisseur" text,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "licences_postes" CHECK ("licences_logicielles"."postes" BETWEEN 1 AND 100000),
	CONSTRAINT "licences_cout" CHECK ("licences_logicielles"."cout" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pleins_carburant" ADD CONSTRAINT "pleins_carburant_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pleins_carburant" ADD CONSTRAINT "pleins_carburant_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pleins_carburant" ADD CONSTRAINT "pleins_carburant_conducteur_id_employees_id_fk" FOREIGN KEY ("conducteur_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicules" ADD CONSTRAINT "vehicules_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicules" ADD CONSTRAINT "vehicules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipements_informatiques" ADD CONSTRAINT "equipements_informatiques_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipements_informatiques" ADD CONSTRAINT "equipements_informatiques_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licences_attribuees" ADD CONSTRAINT "licences_attribuees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licences_attribuees" ADD CONSTRAINT "licences_attribuees_licence_id_licences_logicielles_id_fk" FOREIGN KEY ("licence_id") REFERENCES "public"."licences_logicielles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licences_attribuees" ADD CONSTRAINT "licences_attribuees_actif_id_actifs_id_fk" FOREIGN KEY ("actif_id") REFERENCES "public"."actifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licences_logicielles" ADD CONSTRAINT "licences_logicielles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pleins_actif_idx" ON "pleins_carburant" USING btree ("organization_id","actif_id","fait_le");--> statement-breakpoint
CREATE INDEX "licences_attribuees_actif_idx" ON "licences_attribuees" USING btree ("actif_id");--> statement-breakpoint
CREATE INDEX "licences_expiration_idx" ON "licences_logicielles" USING btree ("organization_id","expire_le");--> statement-breakpoint
ALTER TABLE "vehicules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pleins_carburant" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipements_informatiques" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "licences_logicielles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "licences_attribuees" ENABLE ROW LEVEL SECURITY;