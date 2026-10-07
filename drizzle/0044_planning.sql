CREATE TYPE "public"."statut_planning" AS ENUM('disponible', 'occupe', 'en_reunion', 'en_mission', 'sur_terrain', 'en_course', 'en_deplacement', 'en_pause', 'teletravail', 'en_conge', 'absent');--> statement-breakpoint
CREATE TABLE "creneaux_planning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"statut" "statut_planning" NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"lieu" text,
	"note" text,
	"saisi_par_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "creneaux_planning_periode" CHECK ("creneaux_planning"."fin" > "creneaux_planning"."debut"),
	CONSTRAINT "creneaux_planning_duree" CHECK ("creneaux_planning"."fin" - "creneaux_planning"."debut" <= interval '31 days')
);
--> statement-breakpoint
CREATE TABLE "horaires_planning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"jour" integer NOT NULL,
	"debut_minutes" integer NOT NULL,
	"fin_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "horaires_planning_jour" CHECK ("horaires_planning"."jour" BETWEEN 1 AND 7),
	CONSTRAINT "horaires_planning_plage" CHECK ("horaires_planning"."debut_minutes" >= 0 AND "horaires_planning"."fin_minutes" <= 1440 AND "horaires_planning"."fin_minutes" > "horaires_planning"."debut_minutes")
);
--> statement-breakpoint
ALTER TABLE "creneaux_planning" ADD CONSTRAINT "creneaux_planning_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horaires_planning" ADD CONSTRAINT "horaires_planning_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creneaux_planning_user_idx" ON "creneaux_planning" USING btree ("organization_id","user_id","debut");--> statement-breakpoint
CREATE INDEX "creneaux_planning_periode_idx" ON "creneaux_planning" USING btree ("organization_id","debut","fin");--> statement-breakpoint
CREATE INDEX "horaires_planning_user_idx" ON "horaires_planning" USING btree ("organization_id","user_id","jour");--> statement-breakpoint
ALTER TABLE "creneaux_planning" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "horaires_planning" ENABLE ROW LEVEL SECURITY;
