-- Brand mark for a technology, resolved from Simple Icons when it is registered.
-- Nullable throughout: products the icon set does not carry render as a
-- lettered tile, and existing rows keep their marks resolved by name until a
-- later edit fills these in.
ALTER TABLE "technology" ADD COLUMN "icon_slug" TEXT;
ALTER TABLE "technology" ADD COLUMN "icon_colour" TEXT;
