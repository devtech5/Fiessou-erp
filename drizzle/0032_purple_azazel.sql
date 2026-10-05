CREATE TABLE "contacts_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tiers_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"fonction" text,
	"telephone" text,
	"email" text,
	"principal" boolean DEFAULT false NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commandes_achat" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "commandes_achat" ADD COLUMN "contact_nom" text;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD COLUMN "contact_nom" text;--> statement-breakpoint
ALTER TABLE "contacts_tiers" ADD CONSTRAINT "contacts_tiers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts_tiers" ADD CONSTRAINT "contacts_tiers_tiers_id_tiers_id_fk" FOREIGN KEY ("tiers_id") REFERENCES "public"."tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_tiers_tiers_idx" ON "contacts_tiers" USING btree ("organization_id","tiers_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tiers_principal_unique" ON "contacts_tiers" USING btree ("tiers_id") WHERE "contacts_tiers"."principal" AND "contacts_tiers"."actif";--> statement-breakpoint
ALTER TABLE "commandes_achat" ADD CONSTRAINT "commandes_achat_contact_id_contacts_tiers_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD CONSTRAINT "pieces_commerciales_contact_id_contacts_tiers_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts_tiers" ENABLE ROW LEVEL SECURITY;