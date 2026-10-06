CREATE TYPE "public"."nature_piece_employe" AS ENUM('cni', 'passeport', 'cmu', 'permis', 'casier_judiciaire', 'assurance', 'extrait_naissance', 'certificat_medical', 'diplome', 'rib', 'cv', 'lettre_motivation', 'autre');--> statement-breakpoint
CREATE TABLE "pieces_employe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"nature" "nature_piece_employe" NOT NULL,
	"numero" text,
	"organisme" text,
	"precision" text,
	"delivree_le" date,
	"expire_le" date,
	"chemin" text,
	"nom_fichier" text,
	"type_mime" text,
	"taille_octets" integer,
	"notes" text,
	"user_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pieces_employe_fichier_complet" CHECK (("pieces_employe"."chemin" IS NULL) = ("pieces_employe"."nom_fichier" IS NULL) AND ("pieces_employe"."chemin" IS NULL) = ("pieces_employe"."type_mime" IS NULL)),
	CONSTRAINT "pieces_employe_dates" CHECK ("pieces_employe"."expire_le" IS NULL OR "pieces_employe"."delivree_le" IS NULL OR "pieces_employe"."expire_le" >= "pieces_employe"."delivree_le")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "date_naissance" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "lieu_naissance" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "nationalite" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "sexe" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "situation_familiale" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "enfants_a_charge" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "contact_urgence" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "photo" text;--> statement-breakpoint
ALTER TABLE "pieces_employe" ADD CONSTRAINT "pieces_employe_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_employe" ADD CONSTRAINT "pieces_employe_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pieces_employe_salarie_idx" ON "pieces_employe" USING btree ("organization_id","employee_id");--> statement-breakpoint
CREATE INDEX "pieces_employe_expiration_idx" ON "pieces_employe" USING btree ("organization_id","expire_le");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_photo" CHECK ("employees"."photo" IS NULL OR (length("employees"."photo") <= 131072 AND "employees"."photo" LIKE 'data:image/%'));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_sexe" CHECK ("employees"."sexe" IS NULL OR "employees"."sexe" IN ('F', 'M'));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_enfants" CHECK ("employees"."enfants_a_charge" IS NULL OR "employees"."enfants_a_charge" BETWEEN 0 AND 30);--> statement-breakpoint
ALTER TABLE "pieces_employe" ENABLE ROW LEVEL SECURITY;