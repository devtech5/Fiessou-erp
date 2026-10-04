CREATE TYPE "public"."niveau_acces" AS ENUM('aucun', 'consultation', 'complet');--> statement-breakpoint
CREATE TABLE "acces_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"niveau" "niveau_acces" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "acces_modules_unique" UNIQUE("membership_id","module_key")
);
--> statement-breakpoint
ALTER TABLE "acces_modules" ADD CONSTRAINT "acces_modules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_modules" ADD CONSTRAINT "acces_modules_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acces_modules_org_idx" ON "acces_modules" USING btree ("organization_id");--> statement-breakpoint
-- RLS dans la MÊME migration que la création, sans exception.
ALTER TABLE "acces_modules" ENABLE ROW LEVEL SECURITY;
