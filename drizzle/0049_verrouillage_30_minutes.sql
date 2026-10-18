ALTER TABLE "organizations" ALTER COLUMN "delai_verrouillage_minutes" SET DEFAULT 30;--> statement-breakpoint
-- Les entreprises restées sur l'ancien délai par défaut passent à trente minutes.
-- Un délai choisi autrement sur /entreprise (5, 15, 60) est conservé.
UPDATE "organizations" SET "delai_verrouillage_minutes" = 30, "updated_at" = now(), "version" = "version" + 1 WHERE "delai_verrouillage_minutes" = 10;
