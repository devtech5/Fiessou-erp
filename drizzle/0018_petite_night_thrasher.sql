ALTER TABLE "pieces_commerciales" ADD COLUMN "projet_id" uuid;--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "prix_vente" bigint;--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "termine_le" date;--> statement-breakpoint
ALTER TABLE "pieces_commerciales" ADD CONSTRAINT "pieces_commerciales_projet_id_projets_id_fk" FOREIGN KEY ("projet_id") REFERENCES "public"."projets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_prix_vente" CHECK ("projets"."prix_vente" IS NULL OR "projets"."prix_vente" >= 0);