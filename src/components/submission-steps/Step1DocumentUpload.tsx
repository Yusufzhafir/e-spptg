import { useMemo } from 'react';
import { SubmissionDraft } from '../../types';
import { useAuthRole } from '../AuthRoleProvider';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { FileUploadField } from '../FileUploadField';
import { Textarea } from '../ui/textarea';
import { trpc } from '@/trpc/client';
import { SearchableSelect } from '../SearchableSelect';
import { normalizePhoneNumber } from '@/lib/phone-number';
import { normalizeEmail } from '@/lib/email-address';

interface Step1Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
  onPersistDraftPatch: (
    updates: Partial<SubmissionDraft>,
    options?: { silent?: boolean }
  ) => Promise<void>;
  errors?: Record<string, string>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

export function Step1DocumentUpload({
  draft,
  onUpdateDraft,
  onPersistDraftPatch,
  errors = {},
}: Step1Props) {
  const { user } = useAuthRole();
  const { data: villagesData } = trpc.villages.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  /**
   * Admin desa and Verifikator process one desa and one only — `saveStep`
   * refuses a draft on any other. Offering the whole list would just be a trap,
   * so they get their own desa and nothing else. Viewers pick freely (the land
   * is wherever it is), and Superadmin has no desa scope to narrow to.
   *
   * `villages.list` stays unscoped on purpose: it is a globally cached query
   * shared with Pengaturan and the dashboard filters, so the narrowing belongs
   * here rather than in the procedure.
   */
  const scopedVillageId =
    user && (user.peran === 'Admin' || user.peran === 'Verifikator')
      ? user.assignedVillageId
      : null;

  const villages = useMemo(() => {
    const all = villagesData ?? [];
    return scopedVillageId ? all.filter((v) => v.id === scopedVillageId) : all;
  }, [villagesData, scopedVillageId]);

  const handleVillageChange = (value: string) => {
    const villageId = Number(value);
    const selectedVillage = villages.find((v) => v.id === villageId);
    const juruUkur =
      selectedVillage &&
      selectedVillage.juruUkurNama &&
      selectedVillage.juruUkurJabatan &&
      selectedVillage.juruUkurNomorHP
        ? {
            nama: selectedVillage.juruUkurNama,
            jabatan: selectedVillage.juruUkurJabatan,
            instansi: selectedVillage.juruUkurInstansi || undefined,
            nomorHP: selectedVillage.juruUkurNomorHP,
          }
        : undefined;

    onUpdateDraft({
      villageId,
      kecamatan: selectedVillage?.kecamatan,
      kabupaten: selectedVillage?.kabupaten,
      namaKepalaDesa: selectedVillage?.namaKepalaDesa || undefined,
      juruUkur,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Pengajuan Berkas</h2>
        <p className="text-gray-600">
          Lengkapi data pemohon dan unggah dokumen pendukung yang diperlukan.
        </p>
      </div>

      {/* Applicant Data */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Data Pemohon</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="namaPemohon">
              Nama Pemohon <span className="text-red-600">*</span>
            </Label>
            <Input
              id="namaPemohon"
              value={draft.namaPemohon}
              onChange={(e) => onUpdateDraft({ namaPemohon: e.target.value })}
              placeholder="Masukkan nama lengkap"
              aria-invalid={Boolean(errors.namaPemohon)}
              className={errors.namaPemohon ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.namaPemohon} />
          </div>

          <div>
            <Label htmlFor="nik">
              NIK <span className="text-red-600">*</span>
            </Label>
            <Input
              id="nik"
              type="text"
              value={draft.nik}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                onUpdateDraft({ nik: value });
              }}
              placeholder="Masukkan NIK (16 digit)"
              maxLength={16}
              aria-invalid={Boolean(errors.nik)}
              className={errors.nik ? 'border-red-500' : undefined}
            />
            {errors.nik ? (
              <FieldError message={errors.nik} />
            ) : (
              draft.nik &&
              draft.nik.length !== 16 && (
                <p className="text-xs text-red-600 mt-1">NIK harus 16 digit</p>
              )
            )}
          </div>
        </div>

        {/* Personal Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tempatLahir">
              Tempat Lahir <span className="text-red-600">*</span>
            </Label>
            <Input
              id="tempatLahir"
              value={draft.tempatLahir || ''}
              onChange={(e) => onUpdateDraft({ tempatLahir: e.target.value })}
              placeholder="Masukkan tempat lahir"
              aria-invalid={Boolean(errors.tempatLahir)}
              className={errors.tempatLahir ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.tempatLahir} />
          </div>

          <div>
            <Label htmlFor="tanggalLahir">
              Tanggal Lahir <span className="text-red-600">*</span>
            </Label>
            <Input
              id="tanggalLahir"
              type="date"
              value={draft.tanggalLahir || ''}
              onChange={(e) => onUpdateDraft({ tanggalLahir: e.target.value })}
              aria-invalid={Boolean(errors.tanggalLahir)}
              className={errors.tanggalLahir ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.tanggalLahir} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pekerjaan">
              Pekerjaan <span className="text-red-600">*</span>
            </Label>
            <Input
              id="pekerjaan"
              value={draft.pekerjaan || ''}
              onChange={(e) => onUpdateDraft({ pekerjaan: e.target.value })}
              placeholder="Masukkan pekerjaan"
              aria-invalid={Boolean(errors.pekerjaan)}
              className={errors.pekerjaan ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.pekerjaan} />
          </div>

          <div>
            <Label htmlFor="villageId">
              Desa <span className="text-red-600">*</span>
            </Label>
            <SearchableSelect
              id="villageId"
              value={draft.villageId ? String(draft.villageId) : ''}
              onValueChange={handleVillageChange}
              placeholder="Pilih desa"
              searchPlaceholder="Cari desa..."
              className={errors.villageId ? 'border-red-500' : undefined}
              options={villages.map((village) => ({
                value: String(village.id),
                label: village.namaDesa,
              }))}
            />
            <FieldError message={errors.villageId} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nomorHP">
              Nomor HP <span className="text-red-600">*</span>
            </Label>
            <Input
              id="nomorHP"
              type="tel"
              inputMode="tel"
              value={draft.nomorHP || ''}
              onChange={(e) => onUpdateDraft({ nomorHP: e.target.value })}
              // Tidy "+62 812…" / "0812-3456" into 08xxxxxxxxxx once the user
              // moves on, rather than fighting their keystrokes as they type.
              onBlur={(e) => {
                const normalized = normalizePhoneNumber(e.target.value);
                if (normalized !== e.target.value) {
                  onUpdateDraft({ nomorHP: normalized });
                }
              }}
              placeholder="08xxxxxxxxxx atau 0549xxxxxx"
              aria-invalid={Boolean(errors.nomorHP)}
              className={errors.nomorHP ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.nomorHP} />
          </div>

          <div>
            <Label htmlFor="email">
              Email <span className="text-red-600">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={draft.email || ''}
              onChange={(e) => onUpdateDraft({ email: e.target.value })}
              onBlur={(e) => {
                const normalized = normalizeEmail(e.target.value);
                if (normalized !== e.target.value) {
                  onUpdateDraft({ email: normalized });
                }
              }}
              placeholder="nama@email.com"
              aria-invalid={Boolean(errors.email)}
              className={errors.email ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.email} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="alamatKTP">
              Alamat KTP <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="alamatKTP"
              value={draft.alamatKTP || ''}
              onChange={(e) => onUpdateDraft({ alamatKTP: e.target.value })}
              placeholder="Masukkan alamat sesuai KTP"
              rows={3}
              aria-invalid={Boolean(errors.alamatKTP)}
              className={errors.alamatKTP ? 'border-red-500' : undefined}
            />
            <FieldError message={errors.alamatKTP} />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Dokumen Pendukung</h3>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <FileUploadField
              label="Softcopy KTP"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSize={10}
              value={draft.dokumenKTP}
              onChange={(doc) => onPersistDraftPatch({ dokumenKTP: doc })}
              helpText="Contoh: KTP_NamaPemohon_2025.pdf"
              category="KTP"
              draftId={draft.id}
              error={Boolean(errors.dokumenKTP)}
            />
            <FieldError message={errors.dokumenKTP} />
          </div>

          <div>
            <FileUploadField
              label="Softcopy KK"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSize={10}
              value={draft.dokumenKK}
              onChange={(doc) => onPersistDraftPatch({ dokumenKK: doc })}
              helpText="Contoh: KK_NamaPemohon_2025.pdf"
              category="KK"
              draftId={draft.id}
              error={Boolean(errors.dokumenKK)}
            />
            <FieldError message={errors.dokumenKK} />
          </div>

          <div>
            <FileUploadField
              label="Softcopy Kwitansi Jual Beli/Hibah/Keterangan Warisan"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSize={10}
              value={draft.dokumenKwitansi}
              onChange={(doc) => onPersistDraftPatch({ dokumenKwitansi: doc })}
              category="Kwitansi"
              draftId={draft.id}
              error={Boolean(errors.dokumenKwitansi)}
            />
            <FieldError message={errors.dokumenKwitansi} />
          </div>

          <div>
            <FileUploadField
              label="Softcopy Surat Permohonan"
              accept=".pdf"
              maxSize={10}
              value={draft.dokumenPermohonan}
              onChange={(doc) => onPersistDraftPatch({ dokumenPermohonan: doc })}
              category="Permohonan"
              templateType="surat_pernyataan_permohonan.pdf"
              draftId={draft.id}
              error={Boolean(errors.dokumenPermohonan)}
            />
            <FieldError message={errors.dokumenPermohonan} />
          </div>

          <div>
            <FileUploadField
              label="Surat Pernyataan Tidak Sengketa"
              accept=".pdf"
              maxSize={10}
              value={draft.dokumenTidakSengketa}
              onChange={(doc) => onPersistDraftPatch({ dokumenTidakSengketa: doc })}
              category="Tidak Sengketa"
              draftId={draft.id}
              templateType="surat_pernyataan_tidak_sengketa.docx"
              error={Boolean(errors.dokumenTidakSengketa)}
            />
            <FieldError message={errors.dokumenTidakSengketa} />
          </div>
        </div>
      </div>

      {/* Agreement */}
      <div className="pt-4 border-t border-gray-200">
        <div
          className={
            errors.persetujuanData
              ? 'flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg p-4'
              : 'flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4'
          }
        >
          <Checkbox
            id="persetujuan"
            checked={draft.persetujuanData}
            onCheckedChange={(checked) =>
              onUpdateDraft({ persetujuanData: checked as boolean })
            }
            aria-invalid={Boolean(errors.persetujuanData)}
            className={
              errors.persetujuanData ? 'mt-0.5 border-red-500' : 'mt-0.5'
            }
          />
          <label
            htmlFor="persetujuan"
            className="text-sm text-gray-900 cursor-pointer flex-1"
          >
            Saya menyatakan bahwa data dan dokumen yang diunggah adalah benar dan dapat
            dipertanggungjawabkan. <span className="text-red-600">*</span>
          </label>
        </div>
        <FieldError message={errors.persetujuanData} />
      </div>

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <strong>ℹ️ Informasi:</strong> Semua dokumen akan divalidasi oleh tim verifikator.
          Pastikan dokumen yang diunggah jelas dan sesuai dengan ketentuan yang berlaku.
        </p>
      </div>
    </div>
  );
}
