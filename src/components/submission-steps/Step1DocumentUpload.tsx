import { SubmissionDraft } from '../../types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { FileUploadField } from '../FileUploadField';
import { Textarea } from '../ui/textarea';

interface Step1Props {
  draft: SubmissionDraft;
  onUpdateDraft: (updates: Partial<SubmissionDraft>) => void;
}

export function Step1DocumentUpload({ draft, onUpdateDraft }: Step1Props) {
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
            />
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
            />
            {draft.nik && draft.nik.length !== 16 && (
              <p className="text-xs text-red-600 mt-1">NIK harus 16 digit</p>
            )}
          </div>
        </div>

        {/* Personal Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tempatLahir">Tempat Lahir</Label>
            <Input
              id="tempatLahir"
              value={draft.tempatLahir || ''}
              onChange={(e) => onUpdateDraft({ tempatLahir: e.target.value })}
              placeholder="Masukkan tempat lahir"
            />
          </div>

          <div>
            <Label htmlFor="tanggalLahir">Tanggal Lahir</Label>
            <Input
              id="tanggalLahir"
              type="date"
              value={draft.tanggalLahir || ''}
              onChange={(e) => onUpdateDraft({ tanggalLahir: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pekerjaan">Pekerjaan</Label>
            <Input
              id="pekerjaan"
              value={draft.pekerjaan || ''}
              onChange={(e) => onUpdateDraft({ pekerjaan: e.target.value })}
              placeholder="Masukkan pekerjaan"
            />
          </div>

          <div>
            <Label htmlFor="alamatKTP">Alamat KTP</Label>
            <Textarea
              id="alamatKTP"
              value={draft.alamatKTP || ''}
              onChange={(e) => onUpdateDraft({ alamatKTP: e.target.value })}
              placeholder="Masukkan alamat sesuai KTP"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-gray-900">Dokumen Pendukung</h3>

        <div className="grid grid-cols-1 gap-6">
          <FileUploadField
            label="Softcopy KTP"
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10}
            value={draft.dokumenKTP}
            onChange={(doc) => onUpdateDraft({ dokumenKTP: doc })}
            helpText="Contoh: KTP_NamaPemohon_2025.pdf"
            category="KTP"
            draftId={draft.id}
          />

          <FileUploadField
            label="Softcopy KK"
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10}
            value={draft.dokumenKK}
            onChange={(doc) => onUpdateDraft({ dokumenKK: doc })}
            helpText="Contoh: KK_NamaPemohon_2025.pdf"
            category="KK"
            draftId={draft.id}
          />

          <FileUploadField
            label="Softcopy Kwitansi Jual Beli/Hibah/Keterangan Warisan"
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10}
            value={draft.dokumenKwitansi}
            onChange={(doc) => onUpdateDraft({ dokumenKwitansi: doc })}
            category="Kwitansi"
            draftId={draft.id}
          />

          <FileUploadField
            label="Softcopy Surat Permohonan"
            accept=".pdf"
            maxSize={10}
            value={draft.dokumenPermohonan}
            onChange={(doc) => onUpdateDraft({ dokumenPermohonan: doc })}
            category="Permohonan"
            templateType="surat_pernyataan_permohonan.pdf"
            draftId={draft.id}
          />

          <FileUploadField
            label="Surat Pernyataan Tidak Sengketa"
            accept=".pdf"
            maxSize={10}
            value={draft.dokumenTidakSengketa}
            onChange={(doc) => onUpdateDraft({ dokumenTidakSengketa: doc })}
            category="Tidak Sengketa"
            draftId={draft.id}
            templateType="surat_pernyataan_tidak_sengketa.pdf"
            required={false}
          />
        </div>
      </div>

      {/* Agreement */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Checkbox
            id="persetujuan"
            checked={draft.persetujuanData}
            onCheckedChange={(checked) =>
              onUpdateDraft({ persetujuanData: checked as boolean })
            }
            className="mt-0.5"
          />
          <label
            htmlFor="persetujuan"
            className="text-sm text-gray-900 cursor-pointer flex-1"
          >
            Saya menyatakan bahwa data dan dokumen yang diunggah adalah benar dan dapat
            dipertanggungjawabkan.
          </label>
        </div>
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
