import { pgTable, bigint, varchar, integer, timestamp, doublePrecision, geometry, index, text, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core"

export const boundaryDirection = pgEnum("boundary_direction", ['Utara', 'Timur', 'Selatan', 'Barat'])
export const coordinateSystem = pgEnum("coordinate_system", ['geografis', 'utm'])
export const documentCategory = pgEnum("document_category", ['KTP', 'KK', 'Kwitansi', 'Permohonan', 'SK Kepala Desa', 'Berita Acara', 'Pernyataan Jual Beli', 'Asal Usul', 'Tidak Sengketa', 'Foto Lahan', 'SPPG', 'Lampiran Feedback', 'Lainnya'])
export const prohibitedAreaType = pgEnum("prohibited_area_type", ['Hutan Lindung', 'Tanah Pemerintah', 'Cagar Alam', 'Kawasan Industri', 'Fasum/Fasos', 'Sempadan Sungai', 'Sempadan Pantai', 'Kawasan Rawan Bencana', 'Aset TNI/POLRI', 'Lainnya'])
export const statusSpptg = pgEnum("status_spptg", ['SPPTG terdata', 'SPPTG terdaftar', 'Ditolak', 'Ditinjau Ulang', 'Terbit SPPTG'])
export const userRole = pgEnum("user_role", ['Superadmin', 'Admin', 'Verifikator', 'Viewer'])
export const userStatus = pgEnum("user_status", ['Aktif', 'Nonaktif'])
export const validationStatus = pgEnum("validation_status", ['Lolos', 'Perlu Perbaikan'])


export const villages = pgTable("villages", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "villages_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	kodeDesa: varchar("kode_desa", { length: 20 }).notNull(),
	namaDesa: varchar("nama_desa", { length: 255 }).notNull(),
	kecamatan: varchar({ length: 255 }).notNull(),
	kabupaten: varchar({ length: 255 }).notNull(),
	provinsi: varchar({ length: 255 }).notNull(),
	jumlahPengajuan: integer("jumlah_pengajuan").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const overlapResults = pgTable("overlap_results", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "agriculture_land_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submissionId: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	prohibitedAreaId: bigint({ mode: "number" }).notNull(),
	luasOverlap: doublePrecision("luas_overlap").notNull(),
	percentageOverlap: doublePrecision("percentage_overlap"),
	namaKawasan: varchar("nama_kawasan", { length: 255 }).notNull(),
	jenisKawasan: prohibitedAreaType("jenis_kawasan").notNull(),
	intersectionGeom: geometry("intersection_geom", { type: "point" }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const prohibitedAreas = pgTable("prohibited_areas", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "prohibited_areas_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	namaKawasan: varchar("nama_kawasan", { length: 255 }).notNull(),
	jenisKawasan: prohibitedAreaType("jenis_kawasan").notNull(),
	sumberData: varchar("sumber_data", { length: 255 }).notNull(),
	dasarHukum: text("dasar_hukum"),
	tanggalEfektif: timestamp("tanggal_efektif", { mode: 'string' }).notNull(),
	tanggalUnggah: timestamp("tanggal_unggah", { mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	diunggahOleh: bigint({ mode: "number" }),
	statusValidasi: validationStatus("status_validasi").default('Lolos').notNull(),
	aktifDiValidasi: boolean("aktif_di_validasi").default(true).notNull(),
	warna: varchar({ length: 7 }).notNull(),
	catatan: text(),
	geom: geometry({ type: "point" }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("prohibited_areas_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
]);

export const statusHistory = pgTable("status_history", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "status_history_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submissionId: bigint({ mode: "number" }).notNull(),
	statusBefore: statusSpptg("status_before").notNull(),
	statusAfter: statusSpptg("status_after").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	petugas: bigint({ mode: "number" }).notNull(),
	alasan: text(),
	feedback: jsonb(),
	tanggal: timestamp({ mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const submissionDrafts = pgTable("submission_drafts", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "submission_drafts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	currentStep: integer("current_step").default(1).notNull(),
	payload: jsonb().notNull(),
	lastSaved: timestamp("last_saved", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "submissions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	namaPemilik: varchar("nama_pemilik", { length: 255 }).notNull(),
	nik: varchar({ length: 16 }).notNull(),
	alamat: text().notNull(),
	nomorHp: varchar("nomor_hp", { length: 15 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	villageId: bigint({ mode: "number" }).notNull(),
	kecamatan: varchar({ length: 255 }).notNull(),
	kabupaten: varchar({ length: 255 }).notNull(),
	luas: doublePrecision().notNull(),
	penggunaanLahan: varchar("penggunaan_lahan", { length: 255 }).notNull(),
	catatan: text(),
	geom: geometry({ type: "point" }),
	geoJson: jsonb("geo_json"),
	status: statusSpptg().notNull(),
	tanggalPengajuan: timestamp("tanggal_pengajuan", { mode: 'string' }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	verifikator: bigint({ mode: "number" }).notNull(),
	riwayat: jsonb().default([]).notNull(),
	feedback: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("submissions_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
]);

export const submissionsDocuments = pgTable("submissions_documents", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "document_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	filename: varchar({ length: 255 }).notNull(),
	fileType: varchar("file_type", { length: 50 }).notNull(),
	size: integer().notNull(),
	url: text().notNull(),
	category: documentCategory().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submissionId: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	draftId: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	uploadedBy: bigint({ mode: "number" }).notNull(),
	isTemporary: boolean("is_temporary").default(true).notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	nama: varchar({ length: 255 }).notNull(),
	nipNik: varchar("nip_nik", { length: 20 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	peran: userRole().notNull(),
	status: userStatus().default('Aktif').notNull(),
	nomorHp: varchar("nomor_hp", { length: 15 }),
	terakhirMasuk: timestamp("terakhir_masuk", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});
