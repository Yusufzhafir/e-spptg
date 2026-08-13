-- A pengajuan can cover several separated bidang, so its boundary is stored as
-- a MultiPolygon. Existing single-polygon rows are promoted in place with
-- ST_Multi, which is lossless — every predicate the app uses (ST_Intersects,
-- ST_Intersection, ST_Area) behaves identically on a single-part MultiPolygon.
ALTER TABLE "submissions"
  ALTER COLUMN "geom" TYPE geometry(MultiPolygon,4326) USING ST_Multi("geom");
--> statement-breakpoint
-- ST_Intersection of a multi-bidang submission with a kawasan can be a Polygon,
-- a MultiPolygon, or a GeometryCollection where the boundaries merely touch.
-- The Polygon typmod would reject those, failing the whole overlap computation.
ALTER TABLE "overlap_results"
  ALTER COLUMN "intersection_geom" TYPE geometry(Geometry,4326) USING "intersection_geom";
--> statement-breakpoint
-- A kawasan is often a set of detached blocks under one SK, and the boundary
-- files that define them arrive as multi-polygon KML. Same lossless promotion.
ALTER TABLE "prohibited_areas"
  ALTER COLUMN "geom" TYPE geometry(MultiPolygon,4326) USING ST_Multi("geom");
