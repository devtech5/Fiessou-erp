CREATE TYPE "public"."canal_billet" AS ENUM('guichet', 'en_ligne');--> statement-breakpoint
CREATE TYPE "public"."moyen_billet" AS ENUM('especes', 'mobile_money', 'banque');--> statement-breakpoint
CREATE TYPE "public"."statut_billet" AS ENUM('valide', 'embarque', 'annule', 'non_presente');--> statement-breakpoint
CREATE TYPE "public"."statut_depart" AS ENUM('ouvert', 'embarquement', 'parti', 'annule');--> statement-breakpoint
CREATE TYPE "public"."reseau_monnaie" AS ENUM('wave', 'orange', 'mtn', 'moov');--> statement-breakpoint
CREATE TYPE "public"."statut_session_guichet" AS ENUM('ouverte', 'cloturee');--> statement-breakpoint
CREATE TYPE "public"."type_operation_guichet" AS ENUM('depot', 'retrait', 'credit', 'approvisionnement', 'destockage');--> statement-breakpoint
CREATE TABLE "billets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"depart_id" uuid NOT NULL,
	"siege" text NOT NULL,
	"passager" text NOT NULL,
	"telephone" text,
	"piece" text,
	"montant" bigint NOT NULL,
	"canal" "canal_billet" DEFAULT 'guichet' NOT NULL,
	"moyen" "moyen_billet" DEFAULT 'especes' NOT NULL,
	"statut" "statut_billet" DEFAULT 'valide' NOT NULL,
	"ecriture" text,
	"ecriture_annulation" text,
	"embarque_le" timestamp with time zone,
	"motif" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "billets_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "billets_montant" CHECK ("billets"."montant" >= 0),
	CONSTRAINT "billets_annulation_motivee" CHECK ("billets"."statut" <> 'annule' OR "billets"."motif" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "departs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"ligne_id" uuid NOT NULL,
	"part_le" timestamp with time zone NOT NULL,
	"vehicule" text NOT NULL,
	"rangees" integer NOT NULL,
	"tarif" bigint NOT NULL,
	"taux_tva" integer NOT NULL,
	"statut" "statut_depart" DEFAULT 'ouvert' NOT NULL,
	"motif" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "departs_reference_unique" UNIQUE("organization_id","reference"),
	CONSTRAINT "departs_rangees" CHECK ("departs"."rangees" BETWEEN 1 AND 30),
	CONSTRAINT "departs_annulation_motivee" CHECK ("departs"."statut" <> 'annule' OR "departs"."motif" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "lignes_transport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"depart" text NOT NULL,
	"arrivee" text NOT NULL,
	"duree_minutes" integer NOT NULL,
	"distance_km" integer,
	"tarif" bigint NOT NULL,
	"taux_tva" integer DEFAULT 1800 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lignes_transport_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "lignes_transport_tarif" CHECK ("lignes_transport"."tarif" >= 0 AND "lignes_transport"."duree_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "floats_session" (
	"session_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"reseau" "reseau_monnaie" NOT NULL,
	"ouverture" bigint NOT NULL,
	"releve_cloture" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "floats_session_session_id_reseau_pk" PRIMARY KEY("session_id","reseau"),
	CONSTRAINT "floats_session_positifs" CHECK ("floats_session"."ouverture" >= 0 AND coalesce("floats_session"."releve_cloture", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "operations_guichet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"type" "type_operation_guichet" NOT NULL,
	"reseau" "reseau_monnaie" NOT NULL,
	"telephone" text,
	"montant" bigint NOT NULL,
	"commission" bigint DEFAULT 0 NOT NULL,
	"reference_operateur" text,
	"annulee_le" timestamp with time zone,
	"motif" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "operations_guichet_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "operations_guichet_montant" CHECK ("operations_guichet"."montant" > 0 AND "operations_guichet"."commission" >= 0),
	CONSTRAINT "operations_guichet_annulation_motivee" CHECK ("operations_guichet"."annulee_le" IS NULL OR "operations_guichet"."motif" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "sessions_guichet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"statut" "statut_session_guichet" DEFAULT 'ouverte' NOT NULL,
	"ouverte_le" timestamp with time zone DEFAULT now() NOT NULL,
	"ouverte_par" uuid,
	"fond_caisse" bigint NOT NULL,
	"cloturee_le" timestamp with time zone,
	"cloture_par" uuid,
	"especes_comptees" bigint,
	"ecart_especes" bigint,
	"ecriture" text,
	"observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sessions_guichet_numero_unique" UNIQUE("organization_id","numero"),
	CONSTRAINT "sessions_guichet_fond" CHECK ("sessions_guichet"."fond_caisse" >= 0),
	CONSTRAINT "sessions_guichet_cloture_complete" CHECK ("sessions_guichet"."statut" = 'ouverte' OR ("sessions_guichet"."especes_comptees" IS NOT NULL AND "sessions_guichet"."ecart_especes" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "billets" ADD CONSTRAINT "billets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billets" ADD CONSTRAINT "billets_depart_id_departs_id_fk" FOREIGN KEY ("depart_id") REFERENCES "public"."departs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departs" ADD CONSTRAINT "departs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departs" ADD CONSTRAINT "departs_ligne_id_lignes_transport_id_fk" FOREIGN KEY ("ligne_id") REFERENCES "public"."lignes_transport"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_transport" ADD CONSTRAINT "lignes_transport_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floats_session" ADD CONSTRAINT "floats_session_session_id_sessions_guichet_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions_guichet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floats_session" ADD CONSTRAINT "floats_session_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_guichet" ADD CONSTRAINT "operations_guichet_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_guichet" ADD CONSTRAINT "operations_guichet_session_id_sessions_guichet_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions_guichet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions_guichet" ADD CONSTRAINT "sessions_guichet_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billets_siege_unique" ON "billets" USING btree ("depart_id","siege") WHERE "billets"."statut" <> 'annule';--> statement-breakpoint
CREATE INDEX "billets_depart_idx" ON "billets" USING btree ("depart_id","statut");--> statement-breakpoint
CREATE INDEX "departs_org_idx" ON "departs" USING btree ("organization_id","part_le");--> statement-breakpoint
CREATE INDEX "operations_guichet_session_idx" ON "operations_guichet" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_guichet_une_ouverte" ON "sessions_guichet" USING btree ("organization_id") WHERE "sessions_guichet"."statut" = 'ouverte';--> statement-breakpoint
-- RLS dans la MÊME migration que la création : une table oubliée ici livre
-- les passagers, leurs pièces d'identité et les floats de toutes les entreprises.
ALTER TABLE "lignes_transport" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "departs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions_guichet" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "floats_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "operations_guichet" ENABLE ROW LEVEL SECURITY;
