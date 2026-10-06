ALTER TABLE "sessions" ADD COLUMN "verrouillee_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "delai_verrouillage_minutes" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_delai_verrouillage" CHECK ("organizations"."delai_verrouillage_minutes" BETWEEN 1 AND 240);