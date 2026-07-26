ALTER TABLE "overlap_results"
  ALTER COLUMN "intersection_geom" TYPE geometry(Polygon,4326) USING NULL;