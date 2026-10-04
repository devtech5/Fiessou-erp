ALTER TABLE "sessions_guichet" ADD COLUMN "ouverture_comptabilisee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions_guichet" ADD COLUMN "ecriture_ouverture" text;