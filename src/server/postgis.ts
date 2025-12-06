 import { db, DBTransaction } from './db/db';
 import { sql } from 'drizzle-orm';

/**
 * Convert GeoJSON (Polygon) to PostGIS geometry and insert submission
 */
 export async function insertSubmissionWithGeometry(submissionData: any, geoJsonPolygon: any,tx?:DBTransaction) {
   const queryDb = tx || db
   const geomWKT = geojsonToWKT(geoJsonPolygon);

   return queryDb.execute(
     sql`
       INSERT INTO submissions (
         nama_pemilik, nik, alamat, nomor_hp, email,
         village_id, kecamatan, kabupaten, luas, penggunaan_lahan,
         catatan, geom, geo_json, status, tanggal_pengajuan, verifikator, riwayat
       ) VALUES (
         ${submissionData.namaPemilik},
         ${submissionData.nik},
         ${submissionData.alamat},
         ${submissionData.nomorHP},
         ${submissionData.email},
         ${submissionData.villageId},
         ${submissionData.kecamatan},
         ${submissionData.kabupaten},
         ${submissionData.luas},
         ${submissionData.penggunaanLahan},
         ${submissionData.catatan || null},
         ST_GeomFromGeoJSON(${JSON.stringify(geoJsonPolygon)})::geometry(Polygon, 4326),
         ${JSON.stringify(geoJsonPolygon)},
         ${submissionData.status},
         ${submissionData.tanggalPengajuan},
         ${submissionData.verifikator},
         ${JSON.stringify(submissionData.riwayat)}
       )
       RETURNING id;
     `
   );
 }

 /**
  * Find overlapping prohibited areas and insert into overlap_results
  */
 export async function computeOverlaps(submissionId: number,tx?:DBTransaction) {
   const queryDb = tx || db

   const result = await queryDb.execute(
     sql`
       INSERT INTO overlap_results (
         submission_id, prohibited_area_id, luas_overlap, 
         percentage_overlap, nama_kawasan, jenis_kawasan, 
         intersection_geom
       )
       SELECT 
         ${submissionId},
         pa.id,
         ST_Area(ST_Intersection(s.geom, pa.geom))::double precision,
         (ST_Area(ST_Intersection(s.geom, pa.geom)) / ST_Area(s.geom) * 100)::double precision,
         pa.nama_kawasan,
         pa.jenis_kawasan,
         ST_Intersection(s.geom, pa.geom)
       FROM submissions s
       JOIN prohibited_areas pa ON ST_Intersects(s.geom, pa.geom)
       WHERE s.id = ${submissionId}
       AND pa.aktif_di_validasi = true;
     `
   );

   return result;
 }

 function geojsonToWKT(geojson: any): string {
   if (geojson.type === 'Polygon') {
     const coords = geojson.coordinates[0]
       .map((coord: number[]) => `${coord[0]} ${coord[1]}`)
       .join(', ');
     return `POLYGON((${coords}))`;
   }
   throw new Error('Unsupported GeoJSON type');
 }