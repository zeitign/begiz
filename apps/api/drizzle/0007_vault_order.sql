CREATE TABLE "vault_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"order" text NOT NULL,
	"direction" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_folders" ADD COLUMN "grid_cell" integer;--> statement-breakpoint
ALTER TABLE "vault_preferences" ENABLE ROW LEVEL SECURITY;
