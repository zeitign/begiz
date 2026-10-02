ALTER TABLE "webs" ADD COLUMN "sort_position" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "webs_user_sort_position_idx" ON "webs" USING btree ("user_id","sort_position");--> statement-breakpoint
-- Existing webs start in the order they were shown so far: newest first.
UPDATE "webs" SET "sort_position" = "ranked"."row_number" * 1024
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY "created_at" DESC) AS "row_number"
	FROM "webs"
) AS "ranked"
WHERE "webs"."id" = "ranked"."id";
