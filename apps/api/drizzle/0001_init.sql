CREATE TABLE "collection_webs" (
	"collection_id" uuid NOT NULL,
	"web_id" uuid NOT NULL,
	CONSTRAINT "collection_webs_collection_id_web_id_pk" PRIMARY KEY("collection_id","web_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_tags" (
	"web_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "web_tags_web_id_tag_id_pk" PRIMARY KEY("web_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "webs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"preview_key" text,
	"preview_source" text,
	"full_key" text,
	"site_title" text,
	"favicon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_webs" ADD CONSTRAINT "collection_webs_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_webs" ADD CONSTRAINT "collection_webs_web_id_webs_id_fk" FOREIGN KEY ("web_id") REFERENCES "public"."webs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_tags" ADD CONSTRAINT "web_tags_web_id_webs_id_fk" FOREIGN KEY ("web_id") REFERENCES "public"."webs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_tags" ADD CONSTRAINT "web_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_webs_web_idx" ON "collection_webs" USING btree ("web_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_name_idx" ON "collections" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "web_tags_tag_idx" ON "web_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "webs_user_created_idx" ON "webs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "webs_title_trgm_idx" ON "webs" USING gin ("title" gin_trgm_ops);