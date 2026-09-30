-- En Supabase, las tablas de "public" son accesibles desde su API REST con la clave
-- pública del front. Con RLS activado y sin políticas, ese acceso queda cerrado;
-- la API de la app se conecta como propietaria de las tablas y no le afecta.
ALTER TABLE "webs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "web_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_webs" ENABLE ROW LEVEL SECURITY;
