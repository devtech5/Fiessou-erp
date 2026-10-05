ALTER TABLE "organizations" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "rccm" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "couleur_documents" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "pied_de_page" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logo_taille" CHECK ("organizations"."logo" IS NULL OR (length("organizations"."logo") <= 131072 AND "organizations"."logo" LIKE 'data:image/%'));--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_couleur" CHECK ("organizations"."couleur_documents" IS NULL OR "organizations"."couleur_documents" ~ '^#[0-9a-fA-F]{6}$');