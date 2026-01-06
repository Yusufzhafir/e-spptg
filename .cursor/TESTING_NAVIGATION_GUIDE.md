# Testing Navigation Guide - Pengajuan (Submissions) Flow

This document provides a complete guide for navigating and testing the Pengajuan (Submissions) feature in the E-SPPTG application.

**Purpose:** This guide documents the complete navigation flow, all form fields, validation requirements, and button behaviors for testing the submission process, especially Step 3 status options.

**Last Updated:** Based on codebase analysis and browser exploration on localhost:3000

**Key Feature:** The implementation allows direct submission from Step 3 for non-"terdaftar" statuses, while "SPPTG terdaftar" requires Step 4 (issuance).

## Base URL
- Application: `http://localhost:3000`
- Pengajuan Page: `http://localhost:3000/app/pengajuan`

---

## Navigation Structure

### Sidebar Navigation
The application has a sidebar with the following menu items:
1. **Beranda** (Home) - Links to `/app`
2. **Pengajuan** (Submissions) - Links to `/app/pengajuan` (active page)
3. **Verifikasi** (Verification) - Links to verification page
4. **Peta** (Map) - Links to map view
5. **Laporan** (Reports) - Links to reports
6. **Pengaturan** (Settings) - Links to settings

### Header
- Search box: "Cari nama pemilik, NIK, atau desa…"
- User menu button (shows user avatar)

---

## Pengajuan Drafts List Page

**URL:** `/app/pengajuan`

### Page Elements

#### Breadcrumb Navigation
- Beranda → Draft Pengajuan (current page, disabled)

#### Page Header
- **Title:** "Draft Pengajuan" (H1)
- **Subtitle:** "Kelola draft pengajuan SPPTG Anda"
- **Action Button:** "Buat Draft Baru" (Create New Draft button)

#### Drafts Table
**Columns:**
1. Nama Pemohon (Applicant Name)
2. NIK (National ID)
3. Tahap (Step/Stage)
4. Terakhir Disimpan (Last Saved)
5. Aksi (Actions)

**Action Buttons (per row):**
- "Lanjutkan" (Continue) button - Opens the draft for editing
- Delete button (trash icon)

**Example Draft Data:**
- Draft 1: "Draft Baru", NIK: "-", Tahap: "Berkas", Last Saved: "07 Jan 2026, 04.32"
- Draft 2: "akjshdaksjhdakjdhkhaskjdhask", NIK: "1231231231221312", Tahap: "Berkas", Last Saved: "30 Des 2025, 23.22"

---

## Draft Submission Flow

**URL Pattern:** `/app/pengajuan/draft/{draftId}`

The submission flow consists of 4 steps with a stepper indicator at the top.

### Stepper Indicators
1. **Berkas** (Documents) - Step 1
2. **Lapangan** (Field) - Step 2
3. **Hasil** (Results) - Step 3
4. **Terbitkan SPPTG** (Issue SPPTG) - Step 4
   - Shows warning: "Hanya tersedia jika status 'SPPTG terdaftar'"

### Breadcrumb (within draft)
- Beranda → Pengajuan → Draft #{draftId}

### Header
- **Title:** "Pengajuan SPPTG" (H1)
- **Draft ID:** Shows "Draft ID: {id}"
- **Last Saved:** Shows "Draf disimpan pukul {time}"

---

## STEP 1: BERKAS (Documents)

### Section: "Pengajuan Berkas"
**Description:** "Lengkapi data pemohon dan unggah dokumen pendukung yang diperlukan."

### Data Pemohon (Applicant Data)

#### Required Fields:
1. **Nama Pemohon** (Applicant Name)
   - Text input
   - Placeholder: "Masukkan nama lengkap"
   - Required field (marked with *)

2. **NIK** (National ID)
   - Text input
   - Placeholder: "Masukkan NIK (16 digit)"
   - Required field (marked with *)
   - Must be 16 digits

### Dokumen Pendukung (Supporting Documents)

#### Required Documents:
1. **Softcopy KTP** (ID Card)
   - File upload area
   - Accepted formats: .PDF, .JPG, .JPEG, .PNG
   - Max size: 10 MB
   - Example filename: "KTP_NamaPemohon_2025.pdf"
   - Required field (marked with *)

2. **Softcopy KK** (Family Card)
   - File upload area
   - Accepted formats: .PDF, .JPG, .JPEG, .PNG
   - Max size: 10 MB
   - Example filename: "KK_NamaPemohon_2025.pdf"
   - Required field (marked with *)

3. **Softcopy Kwitansi Jual Beli/Hibah/Keterangan Warisan** (Purchase Receipt/Donation/Heritage Certificate)
   - File upload area
   - Accepted formats: .PDF, .JPG, .JPEG, .PNG
   - Max size: 10 MB
   - Required field (marked with *)

4. **Softcopy Surat Permohonan** (Application Letter)
   - File upload area
   - Accepted formats: .PDF
   - Max size: 10 MB
   - Template download link: "Unduh template: Surat Pernyataan Permohonan.pdf"
   - Required field (marked with *)

#### Optional Documents:
5. **Surat Pernyataan Tidak Sengketa** (Non-Dispute Statement)
   - File upload area
   - Accepted formats: .PDF
   - Max size: 10 MB
   - Template download link: "Unduh template: Surat Pernyataan Tidak Sengketa.pdf"

### Consent Checkbox
- **Text:** "Saya menyatakan bahwa data dan dokumen yang diunggah adalah benar dan dapat dipertanggungjawabkan."
- **Translation:** "I declare that the data and documents uploaded are true and accountable."
- **Required:** Must be checked to proceed

### Information Box
- **Text:** "ℹ️ Informasi: Semua dokumen akan divalidasi oleh tim verifikator. Pastikan dokumen yang diunggah jelas dan sesuai dengan ketentuan yang berlaku."
- **Translation:** "Information: All documents will be validated by the verifier team. Make sure the uploaded documents are clear and comply with applicable regulations."

### Action Buttons (Step 1)
1. **Batal** (Cancel) - Left side
2. **Simpan Draf** (Save Draft) - Right side
3. **Berikutnya** (Next) - Right side, next to Save Draft

**Note:** To proceed to Step 2, must have:
- Nama Pemohon filled
- NIK filled (16 digits)
- Consent checkbox checked
- At minimum, KTP and KK documents uploaded

---

## STEP 2: LAPANGAN (Field Validation)

### Section: "Validasi Lapangan"
**Description:** "Isi data tim peneliti, saksi batas, dan koordinat lahan hasil survey lapangan."

### Tim Peneliti (Research Team)

#### Juru Ukur (Surveyor)
**Fields (all text inputs):**
1. **Nama** (Name)
2. **Jabatan** (Position)
3. **Instansi** (Institution)
4. **Nomor HP** (Phone Number)

**Note:** All fields appear to be optional (no asterisks visible)

### Saksi Batas Lahan (Boundary Witnesses)

**Form Fields:**
- **Nama saksi** (Witness Name) - Text input
- **Sisi** (Side) - Dropdown/Combobox (options not visible without interaction)
- **"Tambah"** (Add) button - Adds witness to list

**Validation Requirement:**
- **Minimum:** At least 1 witness required
- **Error message:** "Minimal 1 saksi diperlukan"

**Witness Sides (confirmed from UI):**
1. Utara (North)
2. Timur Laut (Northeast)
3. Timur (East)
4. Tenggara (Southeast)
5. Selatan (South)
6. Barat Daya (Southwest)
7. Barat (West)
8. Barat Laut (Northwest)

### Titik Koordinat Patok/Pal Batas (Coordinate Points/Markers)

**Section Header:**
- **Title:** "Titik Koordinat Patok/Pal Batas"
- **Action Button:** "Tambah Titik" (Add Point)

**Coordinate System:**
- **System:** Geografis (Geographic) - (Lat, Lon)
- Display shows: "Sistem Koordinat: Geografis (Lat, Lon)"

**Coordinate List Display:**
- When empty: Shows "Belum ada titik koordinat" (No coordinates yet)
- Instruction: "Klik 'Tambah Titik' untuk memulai" (Click 'Add Point' to start)
- Counter: Shows "Minimal 3 titik diperlukan (X/3)" where X is current count

**Pratinjau Peta (Map Preview)**
- Interactive Google Maps view
- Map controls visible (Map/Satellite toggle, drawing tools)
- **Drawing Toolbar:**
  - "Stop drawing" option
  - "Draw a shape" option (can be active)
  - Fullscreen toggle
  - Map type selector (Map/Satellite)

**Instructions:**
1. "Klik pada peta untuk menambahkan titik koordinat" (Click on map to add coordinate points)
2. "Gunakan toolbar di atas untuk menggambar poligon" (Use toolbar above to draw polygon)
3. "Drag marker atau vertex untuk mengedit" (Drag marker or vertex to edit)
4. "Minimal 3 titik diperlukan" (Minimum 3 points required)

**Validation Requirement:**
- **Minimum:** At least 3 coordinates required to form polygon
- **Error message:** "Minimal 3 koordinat untuk membentuk polygon"

**Action Button:**
- **"Cek Tumpang Tindih"** (Check Overlap) - Disabled until coordinates are added

### Dokumen Lapangan (Field Documents)

**Section Description:**
"Unggah dokumen hasil validasi lapangan (format PDF, maks. 10 MB)"

**Required Document:**
1. **Berita Acara Validasi Lapangan** (Field Validation Report)
   - File upload area
   - Accepted format: .PDF only
   - Max size: 10 MB
   - Template download link: "Unduh template: Berita Acara Validasi Lapangan.pdf"
   - Required field (marked with *)

### Action Buttons (Step 2)
1. **Batal** (Cancel) - Left side
2. **Simpan Draf** (Save Draft) - Center
3. **Sebelumnya** (Previous) - Right side (appears when on Step 2+)
4. **Berikutnya** (Next) - Right side

**Note:** "Berikutnya" button is disabled until:
- At least 1 witness is added
- At least 3 coordinates are added/entered

**Validation Errors (observed):**
When trying to proceed without required data:
- Error toast appears: "Gagal menyimpan draf: [validation errors]"
- Validation errors shown:
  - "Minimal 1 saksi diperlukan" (At least 1 witness required)
  - "Minimal 3 koordinat untuk membentuk polygon" (At least 3 coordinates required to form polygon)

---

## STEP 3: HASIL (Results/Verification)

**CRITICAL STEP FOR TESTING STATUS OPTIONS**

### Section: "Hasil Pengajuan"
**Description:** "Tinjau ringkasan pengajuan dan tentukan status keputusan."

### Page Layout

The page has a two-column grid layout:

#### Left Column - Data Summary

**1. Data Pemohon (Applicant Data)**
- Shows:
  - Nama (Name)
  - NIK (National ID)

**2. Kelengkapan Dokumen (Document Completeness)**
- Checklist showing which documents are uploaded:
  - KTP (ID Card) - Check/Uncheck icon
  - KK (Family Card) - Check/Uncheck icon
  - Kwitansi Jual Beli (Purchase Receipt) - Check/Uncheck icon
  - Surat Permohonan (Application Letter) - Check/Uncheck icon
  - Berita Acara Lapangan (Field Report) - Check/Uncheck icon

**3. Tim Peneliti (Research Team)**
- Shows:
  - Juru Ukur (Surveyor): Name

**4. Saksi Batas Lahan (Boundary Witnesses)**
- List of witnesses with:
  - Name
  - Side (Utara, Timur, etc.) - shown as badge
- If no witnesses: Shows "Belum ada saksi"

**5. Luas Lahan (Land Area)**
- Large display showing:
  - Area in m² (formatted with thousand separators)
  - Map pin icon
  - Number of coordinate points recorded
- Example: "0 m²" or "329,059 m²"

**6. Overlap Status (Tumpang Tindih)**
- **If NO overlap:**
  - Green background box
  - CheckCircle icon
  - Text: "Tidak Ada Tumpang Tindih"
  - Subtext: "Lahan tidak overlap dengan kawasan non-SPPTG"

- **If HAS overlap:**
  - Orange/yellow background box
  - AlertTriangle icon
  - Text: "Ada Tumpang Tindih"
  - Subtext: Shows count "X kawasan non-SPPTG terdeteksi"
  - "Lihat detail overlap →" button (opens dialog)

#### Right Column - Map Preview & Decision

**1. Peta Lahan yang Diajukan (Proposed Land Map)**
- Map preview area
- Shows coordinate point count
- Legend showing:
  - Blue rectangle: "Lahan Pengajuan"
  - Orange rectangle (if overlap): "Kawasan Non-SPPTG"
- If no coordinates: Shows placeholder with MapPin icon

**2. Keputusan Status (Status Decision)**
- Main decision form

#### Status Selection

**Status Dropdown:**
Options available:
1. **SPPTG terdaftar** (Registered)
2. **SPPTG terdata** (Recorded)
3. **SPPTG ditinjau ulang** (Under Review)
4. **SPPTG ditolak** (Rejected)

**Status-Specific Information Messages:**

When a status is selected, an informational box appears with:

**For "SPPTG terdata":**
- Blue info box
- Text: "ℹ️ Pengajuan akan disimpan dengan status terdata. Tidak perlu menerbitkan SPPTG. Anda dapat langsung submit setelah menyimpan keputusan."

**For "SPPTG ditolak":**
- Blue info box
- Text: "ℹ️ Keputusan penolakan akan disimpan dan feedback akan dikirim ke pemohon. Tidak perlu menerbitkan SPPTG."

**For "SPPTG ditinjau ulang":**
- Blue info box
- Text: "ℹ️ Keputusan tinjau ulang akan disimpan dan feedback akan dikirim ke pemohon. Tidak perlu menerbitkan SPPTG."

**For "SPPTG terdaftar":**
- Blue info box
- Text: "✓ Langkah 'Penerbitan SPPTG' akan terbuka setelah menyimpan keputusan."

#### Feedback Form (Required for "ditolak" and "ditinjau ulang")

**Note:** Feedback form appears ONLY when status is "SPPTG ditolak" or "SPPTG ditinjau ulang"

**Fields:**
1. **Alasan (Reasons)** - Checkbox list
   - Required: At least 1 reason must be selected
   - Options:
     - Dokumen tidak lengkap
     - Dokumen tidak sah/tidak terbaca
     - Ketidaksesuaian identitas (NIK/nama/alamat)
     - Koordinat/polygon tidak valid
     - Overlap dengan Kawasan Non-SPPTG
     - Ketidaksesuaian riwayat kepemilikan
     - Lainnya

2. **Dokumen Tidak Lengkap** - Conditional field
   - Only shown if "Dokumen tidak lengkap" is checked
   - Checkbox list:
     - KTP
     - KK
     - Kwitansi/Hibah/Warisan
     - Surat Permohonan
     - Berita Acara Lapangan
     - Pernyataan Jual Beli
     - Asal Usul
     - Tidak Sengketa

3. **Template Cepat (Quick Templates)**
   - Buttons for quick feedback templates:
     - "Dokumen tidak lengkap"
     - "Koordinat tidak valid"
     - "Overlap Non-SPPTG"
   - Clicking applies pre-written feedback text

4. **Detail Feedback**
   - Large textarea
   - Placeholder: "Jelaskan kekurangan dokumen atau instruksi perbaikan (minimal 20 karakter)..."
   - Character counter: "X / 20 karakter minimal"
   - **Required:** Minimum 20 characters
   - Maximum: 1000 characters

5. **Tanggal Tenggat Perbaikan** (Deadline Date)
   - Date picker input
   - Optional field

6. **Lampiran Feedback** (Feedback Attachment)
   - File upload area
   - Accepted formats: PDF, JPG, PNG
   - Max size: 10 MB
   - Optional field
   - Shows uploaded file with:
     - File name
     - File size
     - Remove button (X icon)

#### Verifikator Field
- Appears to be auto-filled (not visible in form but saved)

#### Action Buttons

**"Simpan Keputusan"** button:
- Used when status is "SPPTG terdaftar" or "SPPTG terdata"
- Saves the decision
- For "SPPTG terdaftar": Enables navigation to Step 4

**"Simpan Keputusan & Kirim Feedback"** button:
- Used when status is "SPPTG ditolak" or "SPPTG ditinjau ulang"
- Requires feedback to be completed
- Saves decision and feedback

#### Validation Requirements

**For ALL statuses:**
- Status must be selected

**For "SPPTG ditolak" and "SPPTG ditinjau ulang":**
- At least 1 reason must be selected
- Detail feedback must be at least 20 characters

**Special Validation:**
- If "SPPTG terdaftar" is selected AND there are overlaps:
  - Warning dialog appears: "Peringatan Tumpang Tindih"
  - Asks for confirmation to continue with "SPPTG terdaftar" status despite overlaps
  - Options: "Batal" (Cancel) or "Lanjutkan" (Continue)

#### Dialogs

**1. Overlap Detail Dialog**
- Opens when clicking "Lihat detail overlap →"
- Shows list of overlapping areas:
  - Nama Kawasan (Area Name)
  - Jenis Kawasan (Area Type)
  - Luas Overlap (Overlap Area) in m²
- "Tutup" (Close) button

**2. Feedback History Dialog**
- Opens when clicking "Lihat Detail" on existing feedback
- Shows:
  - Timestamp
  - Pemberi Feedback (Feedback Giver)
  - Alasan Terpilih (Selected Reasons) - as badges
  - Dokumen Tidak Lengkap (if applicable) - as badges
  - Detail Feedback (full text)
  - Tanggal Tenggat (if set)
  - Lampiran (Attachment) with download option

**3. Overlap Warning Dialog**
- AlertDialog shown when approving with overlaps
- Title: "Peringatan Tumpang Tindih"
- Message: "Lahan pengajuan ini tumpang tindih dengan X kawasan non-SPPTG. Tetap lanjutkan dengan status 'SPPTG terdaftar'?"
- Actions:
  - "Batal" (Cancel)
  - "Lanjutkan" (Continue) - orange button

### Button Behavior at Step 3

**When status is NOT "SPPTG terdaftar":**
- Button shows: **"Submit Pengajuan"** (for "SPPTG terdata") or **"Submit Keputusan"** (for "ditolak"/"ditinjau ulang")
- Button color: Green (bg-green-600)
- Action: Submits draft directly without going to Step 4
- Redirects to `/app/pengajuan` after submission

**When status IS "SPPTG terdaftar":**
- Button shows: **"Lanjut ke Penerbitan SPPTG"** or **"Berikutnya"**
- Button color: Blue (bg-blue-600)
- Action: Navigates to Step 4
- Step 4 becomes unlocked

**Button States:**
- Disabled while saving/submitting
- Shows "Mengirim..." when submitting from Step 3
- Shows "Menyimpan..." when saving draft

---

## STEP 4: TERBITKAN SPPTG (Issue SPPTG)

**ACCESS RESTRICTION:** Only accessible when status is "SPPTG terdaftar"

### Section: "Penerbitan SPPTG"
**Description:** "Unggah softcopy SPPTG dan lengkapi informasi penerbitan."

### Status Check Warning

If status is NOT "SPPTG terdaftar":
- Yellow warning box appears:
  - Text: "⚠️ Penerbitan SPPTG hanya tersedia untuk status 'SPPTG terdaftar'. Status saat ini: {current_status}"

### Form Fields (Only shown when status is "SPPTG terdaftar")

**1. Upload Softcopy SPPTG**
- File upload area
- Accepted format: PDF only
- Max size: 10 MB
- **Required:** Yes (marked with *)
- When file is uploaded:
  - Shows file name
  - Shows file size
  - Shows upload timestamp
  - "Ganti" (Replace) button
  - Remove button (X icon)

**2. Nomor SPPTG** (SPPTG Number)
- Text input
- Placeholder: "SPPTG/XX/123/2025"
- **Required:** Yes (marked with *)
- Validation: 5-50 characters
- Helper text: "Masukkan nomor SPPTG sesuai format yang berlaku"

**3. Tanggal Diterbitkan** (Issue Date)
- Date picker input
- **Required:** Yes (marked with *)

### Form Completion Indicator

When all fields are complete:
- Green summary box appears showing:
  - CheckCircle icon
  - "Semua informasi penerbitan telah lengkap" (All issuance information is complete)
  - List of entered data:
    - Dokumen SPPTG: {filename}
    - Nomor SPPTG: {number}
    - Tanggal Terbit: {formatted date}

### Information Box

Blue info box:
- Text: "ℹ️ Informasi: Setelah menekan tombol 'Terbitkan SPPTG', dokumen akan disimpan dan dapat diunduh atau dicetak. Pastikan semua informasi sudah benar sebelum melanjutkan."

### Action Buttons (Step 4)

**Main Button:**
- **"Terbitkan SPPTG"** (Issue SPPTG)
- Color: Green (bg-green-600)
- Action: 
  1. Saves final draft
  2. Submits draft to create submission
  3. Shows success message: "SPPTG berhasil diterbitkan."
  4. Redirects to `/app/pengajuan`

**Other Buttons:**
- **"Batal"** (Cancel) - Left side
- **"Simpan Draf"** (Save Draft)
- **"Sebelumnya"** (Previous) - Navigate back to Step 3

**Button States:**
- Disabled while saving/submitting
- Shows "Menyimpan..." when saving/submitting

---

## Testing Checklist

### Step 1 Testing
- [ ] Verify required fields validation
- [ ] Test file upload functionality
- [ ] Test "Simpan Draf" button
- [ ] Test "Berikutnya" button with valid data
- [ ] Test "Berikutnya" button with invalid/missing data
- [ ] Test "Batal" button (should return to drafts list)

### Step 2 Testing
- [ ] Navigate to Step 2
- [ ] Document all fields
- [ ] Test validation
- [ ] Test navigation

### Step 3 Testing (CRITICAL)
- [ ] Navigate to Step 3
- [ ] Test "SPPTG terdata" status
  - [ ] Verify informational message appears
  - [ ] Verify "Submit Pengajuan" button appears
  - [ ] Verify Step 4 is locked
  - [ ] Test direct submission
- [ ] Test "SPPTG ditolak" status
  - [ ] Verify feedback form appears
  - [ ] Verify informational message appears
  - [ ] Verify "Submit Keputusan" button appears
  - [ ] Verify Step 4 is locked
  - [ ] Test feedback validation
  - [ ] Test direct submission with feedback
- [ ] Test "SPPTG ditinjau ulang" status
  - [ ] Verify feedback form appears
  - [ ] Verify informational message appears
  - [ ] Verify "Submit Keputusan" button appears
  - [ ] Verify Step 4 is locked
  - [ ] Test feedback validation
  - [ ] Test direct submission with feedback
- [ ] Test "SPPTG terdaftar" status
  - [ ] Verify informational message appears
  - [ ] Verify "Lanjut ke Penerbitan SPPTG" button appears
  - [ ] Verify navigation to Step 4 works

### Step 4 Testing
- [ ] Navigate to Step 4 (only if status is "SPPTG terdaftar")
- [ ] Document all fields
- [ ] Test SPPTG issuance
- [ ] Test final submission

---

---

## Complete Navigation Instructions for Testing

### Starting Point
1. Navigate to: `http://localhost:3000/app/pengajuan`
2. Wait for drafts table to load

### To Test Step 3 Status Options

#### Option A: Use Existing Draft (if available at Step 3+)
1. Look for draft with "Tahap" = "Hasil" (Results)
2. Click "Lanjutkan" button for that draft
3. Skip to "Testing Step 3" section below

#### Option B: Create New Draft and Navigate Through Steps

**Step 1 - Create Draft:**
1. Click "Buat Draft Baru" button
2. Wait for notification: "Draft baru berhasil dibuat"
3. Page redirects to `/app/pengajuan/draft/{id}`

**Step 2 - Fill Step 1 (Berkas):**
1. Fill "Nama Pemohon" field (e.g., "Test User")
2. Fill "NIK" field with 16 digits (e.g., "1234567890123456")
3. **Note:** Documents (KTP, KK) are typically required but may be bypassed for testing
4. Check the consent checkbox
5. Click "Berikutnya" button
6. **If validation fails:** Upload at least KTP and KK documents, then try again

**Step 3 - Fill Step 2 (Lapangan):**
1. **Add Witness:**
   - Enter witness name (e.g., "Saksi Test")
   - Click "Sisi" dropdown
   - Select a side (e.g., "Utara")
   - Click "Tambah" button
   - Repeat for at least 1 witness (minimum required)

2. **Add Coordinates:**
   - **Method 1:** Click "Tambah Titik" button to add coordinate points manually
   - **Method 2:** Use map drawing tool:
     - Map shows drawing toolbar with "Draw a shape" active
     - Click on map to place points (minimum 3 points required)
     - Or use polygon drawing tool
   - Verify counter shows "Minimal 3 titik diperlukan (X/3)" where X >= 3
   - Once 3+ coordinates added, "Cek Tumpang Tindih" button becomes enabled

3. **Optional:** Fill Juru Ukur fields (not required for validation)
4. **Optional:** Upload "Berita Acara Validasi Lapangan" document
5. Click "Berikutnya" button
6. **If validation fails:** Ensure at least 1 witness and 3 coordinates are added

**Step 4 - Navigate to Step 3 (Hasil):**
- Page should show "Hasil" step (Step 3)
- Left column shows summary of entered data
- Right column shows map preview and decision form

### Testing Step 3 - Status Options

#### Test 1: SPPTG terdata
1. In Step 3, find "Status SPPTG" dropdown
2. Select "SPPTG terdata"
3. **Verify:**
   - Info message appears: "ℹ️ Pengajuan akan disimpan dengan status terdata..."
   - Button changes to "Submit Pengajuan" (green button)
   - Step 4 indicator shows locked state
4. Click "Submit Pengajuan"
5. **Expected:**
   - Success toast: "Pengajuan berhasil disimpan dengan status terdata."
   - Redirects to `/app/pengajuan`
   - Submission appears in list with status "SPPTG terdata"

#### Test 2: SPPTG ditolak
1. In Step 3, select "SPPTG ditolak"
2. **Verify:**
   - Info message appears: "ℹ️ Keputusan penolakan akan disimpan..."
   - Feedback form appears
   - Button shows "Simpan Keputusan & Kirim Feedback"
3. **Fill Feedback:**
   - Select at least 1 reason checkbox (e.g., "Dokumen tidak lengkap")
   - If "Dokumen tidak lengkap" selected, optionally select documents
   - Enter "Detail Feedback" with at least 20 characters
   - Optionally set deadline date
   - Optionally upload attachment
4. Click "Simpan Keputusan" button first (saves decision)
5. **After saving, verify:**
   - Button changes to "Submit Keputusan" (green button)
   - Step 4 remains locked
6. Click "Submit Keputusan"
7. **Expected:**
   - Success toast: "Keputusan penolakan berhasil disimpan dan akan dikirim ke pemohon."
   - Redirects to `/app/pengajuan`
   - Submission appears with status "SPPTG ditolak"

#### Test 3: SPPTG ditinjau ulang
1. In Step 3, select "SPPTG ditinjau ulang"
2. **Verify:**
   - Info message appears: "ℹ️ Keputusan tinjau ulang akan disimpan..."
   - Feedback form appears
3. Fill feedback (same as Test 2)
4. Click "Simpan Keputusan"
5. Verify button shows "Submit Keputusan"
6. Click "Submit Keputusan"
7. **Expected:**
   - Success toast: "Keputusan tinjau ulang berhasil disimpan dan akan dikirim ke pemohon."
   - Redirects to `/app/pengajuan`
   - Submission appears with status "SPPTG ditinjau ulang"

#### Test 4: SPPTG terdaftar (navigates to Step 4)
1. In Step 3, select "SPPTG terdaftar"
2. **Verify:**
   - Info message appears: "✓ Langkah 'Penerbitan SPPTG' akan terbuka..."
   - Button shows "Lanjut ke Penerbitan SPPTG" or "Berikutnya"
   - Step 4 indicator shows unlocked (no lock icon)
3. Click "Lanjut ke Penerbitan SPPTG"
4. **Expected:**
   - Navigates to Step 4
   - Step 4 form is accessible
   - No warning message appears

#### Test 5: Validation Errors
1. Try to click submit without selecting status
   - **Expected:** Error toast: "Harap tentukan status keputusan terlebih dahulu"
2. Select "SPPTG ditolak" but don't fill feedback
   - Try to proceed: **Expected:** Error toast: "Feedback wajib diisi untuk status ini"
3. Select "SPPTG ditolak", select reason, but detail feedback < 20 chars
   - Try to proceed: **Expected:** Error toast: "Detail feedback wajib diisi minimal 20 karakter"

### Testing Step 4 (Only if status is "SPPTG terdaftar")

1. After navigating from Step 3 with "SPPTG terdaftar" status
2. **Verify:** No warning message, form is accessible
3. Fill required fields:
   - Upload SPPTG document (PDF)
   - Enter Nomor SPPTG (e.g., "SPPTG/XX/123/2025")
   - Select Tanggal Diterbitkan (Issue Date)
4. **Verify:** Green completion box appears
5. Click "Terbitkan SPPTG" button
6. **Expected:**
   - Success toast: "SPPTG berhasil diterbitkan."
   - Redirects to `/app/pengajuan`
   - Submission appears in list with status "SPPTG terdaftar"

---

## Element References (for Browser Automation)

### Common Elements
- **Sidebar Navigation:** Use button text ("Beranda", "Pengajuan", etc.)
- **Breadcrumb links:** Use link text and /url pattern
- **Action buttons:** Look for button text ("Batal", "Simpan Draf", "Berikutnya", etc.)

### Step 1 Elements
- Nama Pemohon input: `textbox "Nama Pemohon *"`
- NIK input: `textbox "NIK *"`
- Consent checkbox: `checkbox "Saya menyatakan..."`

### Step 2 Elements
- Witness name input: `textbox "Nama saksi"`
- Witness side dropdown: `combobox` (click to see options)
- Add witness button: `button "Tambah"`
- Add coordinate button: `button "Tambah Titik"`
- Map drawing tools: `menuitemradio "Draw a shape"`

### Step 3 Elements
- Status dropdown: Look for `combobox` or `select` with status options
- Status options: "SPPTG terdaftar", "SPPTG terdata", "SPPTG ditinjau ulang", "SPPTG ditolak"
- Feedback reasons: Look for checkboxes with reason text
- Detail feedback: `textarea` with placeholder about 20 characters
- Submit button: Changes based on status (check button text)

### Step 4 Elements
- SPPTG document upload: File upload area
- Nomor SPPTG: `textbox` with placeholder "SPPTG/XX/123/2025"
- Tanggal Terbit: Date input
- Submit button: `button "Terbitkan SPPTG"`

---

## Quick Navigation Reference

| Action | From | To | Button/Element |
|--------|------|-----|----------------|
| Go to drafts list | Any page | `/app/pengajuan` | Sidebar "Pengajuan" or breadcrumb "Pengajuan" |
| Create new draft | Drafts list | Draft form Step 1 | "Buat Draft Baru" |
| Open existing draft | Drafts list | Draft form (current step) | "Lanjutkan" button |
| Step 1 → Step 2 | Step 1 | Step 2 | "Berikutnya" (requires: name, NIK, consent) |
| Step 2 → Step 3 | Step 2 | Step 3 | "Berikutnya" (requires: 1 witness, 3 coordinates) |
| Step 3 → Step 4 | Step 3 | Step 4 | "Lanjut ke Penerbitan SPPTG" (only if status = "SPPTG terdaftar") |
| Step 3 → Submit | Step 3 | `/app/pengajuan` | "Submit Pengajuan" or "Submit Keputusan" (if status ≠ "terdaftar") |
| Step 4 → Submit | Step 4 | `/app/pengajuan` | "Terbitkan SPPTG" (requires: document, number, date) |
| Go back | Any step > 1 | Previous step | "Sebelumnya" button |
| Cancel | Any step | Drafts list | "Batal" button |
| Save draft | Any step | Same step | "Simpan Draf" button |

---

## Status Flow Summary

```
Step 3: Select Status
  │
  ├─ "SPPTG terdata"
  │   └─> Submit directly → Redirects to /app/pengajuan
  │
  ├─ "SPPTG ditolak"
  │   └─> Fill feedback → Save → Submit directly → Redirects to /app/pengajuan
  │
  ├─ "SPPTG ditinjau ulang"
  │   └─> Fill feedback → Save → Submit directly → Redirects to /app/pengajuan
  │
  └─ "SPPTG terdaftar"
      └─> Navigate to Step 4 → Fill issuance details → Submit → Redirects to /app/pengajuan
```

---

## Notes for Testing

1. **Draft State:** Drafts auto-save periodically (every 60 seconds if data exists)
2. **Validation:** Client-side validation happens before API calls
3. **Error Messages:** Validation errors appear as toast notifications
4. **Step Locking:** Step 4 is visually locked in stepper UI when status ≠ "terdaftar"
5. **Button States:** Buttons may show loading state ("Menyimpan...", "Mengirim...") during operations
6. **Success Messages:** Each status type has specific success message after submission
7. **Redirect:** After successful submission, always redirects to `/app/pengajuan` (drafts list)
