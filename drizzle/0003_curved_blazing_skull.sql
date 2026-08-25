ALTER TABLE "ecritures" DROP CONSTRAINT "ecritures_piece_unique";--> statement-breakpoint
ALTER TABLE "ecritures" ALTER COLUMN "piece_numero" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ecritures" ADD CONSTRAINT "ecritures_piece_unique" UNIQUE("organization_id","origine","piece_numero");