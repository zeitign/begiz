ALTER TABLE "vault_folders" ADD COLUMN "sort_position" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_links" ADD COLUMN "sort_position" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- The custom order starts as the name order: siblings spaced by 1024, as webs.sort_position.
UPDATE "vault_folders" SET "sort_position" = ranked.row_number * 1024
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "user_id", "parent_id" ORDER BY lower("name"), "created_at") AS row_number
  FROM "vault_folders"
) AS ranked
WHERE "vault_folders"."id" = ranked."id";--> statement-breakpoint
UPDATE "vault_links" SET "sort_position" = ranked.row_number * 1024
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "folder_id" ORDER BY lower("title"), "created_at") AS row_number
  FROM "vault_links"
) AS ranked
WHERE "vault_links"."id" = ranked."id";
