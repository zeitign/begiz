CREATE TABLE "vault_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_link_tags" (
	"link_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "vault_link_tags_link_id_tag_id_pk" PRIMARY KEY("link_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "vault_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"folder_id" uuid,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_parent_id_vault_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vault_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_link_tags" ADD CONSTRAINT "vault_link_tags_link_id_vault_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."vault_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_link_tags" ADD CONSTRAINT "vault_link_tags_tag_id_vault_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."vault_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_links" ADD CONSTRAINT "vault_links_folder_id_vault_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."vault_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vault_folders_user_parent_idx" ON "vault_folders" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "vault_link_tags_tag_idx" ON "vault_link_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "vault_links_user_folder_idx" ON "vault_links" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_tags_user_name_idx" ON "vault_tags" USING btree ("user_id","name");--> statement-breakpoint
-- Closes Supabase's REST access with the front's public key, as in 0002.
ALTER TABLE "vault_folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vault_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vault_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vault_link_tags" ENABLE ROW LEVEL SECURITY;
