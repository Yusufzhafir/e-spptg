import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { Button } from './ui/button';
import { Check, FileText, MapPin, ClipboardCheck, Award } from 'lucide-react';
import { StatusSPPTG, SubmissionDraft } from '../types';
import { Step1DocumentUpload } from './submission-steps/Step1DocumentUpload';
import { Step2FieldValidation } from './submission-steps/Step2FieldValidation';
import { Step3Results } from './submission-steps/Step3Results';
import { Step4Issuance } from './submission-steps/Step4Issuance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';
import { useRouter } from 'next/navigation';

interface SubmissionFlowProps {
  draftId: number;
  onCancel: () => void;
  onComplete: (draft: SubmissionDraft) => void;
}

const steps = [
  { id: 1, label: 'Berkas', icon: FileText },
  { id: 2, label: 'Lapangan', icon: MapPin },
  { id: 3, label: 'Hasil', icon: ClipboardCheck },
  { id: 4, label: 'Terbitkan SPPTG', icon: Award },
];

export function SubmissionFlow({ draftId, onCancel, onComplete }: SubmissionFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [lastSaved, setLastSaved] = useState<string>('');
  const isSubmittingFromStep3 = useRef(false);

  // Load draft from backend
  const { data: draftData, isLoading: isLoadingDraft, error: draftError } = trpc.drafts.getById.useQuery({ draftId });

  // Save draft mutation
  const saveDraftMutation = trpc.drafts.saveStep.useMutation({
    onSuccess: (data) => {
      const time = new Date(data.lastSaved).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSaved(time);
      toast.success('Draf berhasil disimpan');
    },
    onError: (error) => {
      toast.error(`Gagal menyimpan draf: ${error.message}`);
    },
  });

  // Submit draft mutation
  const submitDraftMutation = trpc.submissions.submitDraft.useMutation({
    onSuccess: (data) => {
      // If submitting from Step 3, handleSubmitFromStep3 will show status-specific message
      if (!isSubmittingFromStep3.current) {
        toast.success('Pengajuan berhasil disimpan');
        router.push(`/app/pengajuan`);
      }
    },
    onError: (error) => {
      toast.error(`Gagal menyimpan pengajuan: ${error.message}`);
      isSubmittingFromStep3.current = false;
    },
  });

  // Initialize draft state from backend
  const [draft, setDraft] = useState<SubmissionDraft>({
    id: undefined,
    currentStep: 1,
    namaPemohon: '',
    nik: '',
    persetujuanData: false,
    saksiList: [],
    coordinateSystem: 'geografis',
    coordinatesGeografis: [],
    fotoLahan: [],
    overlapResults: [],
  });

  // Sync draft from backend
  useEffect(() => {
    if (draftData) {
      const payload = draftData.payload as any;
      setDraft({
        id: draftData.id,
        currentStep: draftData.currentStep,
        lastSaved: draftData.lastSaved,
        // Step 1: Applicant Data
        namaPemohon: payload.namaPemohon || '',
        nik: payload.nik || '',
        tempatLahir: payload.tempatLahir,
        tanggalLahir: payload.tanggalLahir,
        pekerjaan: payload.pekerjaan,
        alamatKTP: payload.alamatKTP,
        persetujuanData: payload.persetujuanData || false,
        // Step 2: Land Location & Details
        villageId: payload.villageId,
        namaJalan: payload.namaJalan,
        namaGang: payload.namaGang,
        nomorPersil: payload.nomorPersil,
        rtrw: payload.rtrw,
        dusun: payload.dusun,
        kecamatan: payload.kecamatan,
        kabupaten: payload.kabupaten,
        penggunaanLahan: payload.penggunaanLahan,
        tahunAwalGarap: payload.tahunAwalGarap,
        namaKepalaDesa: payload.namaKepalaDesa,
        saksiList: payload.saksiList || [],
        coordinateSystem: payload.coordinateSystem || 'geografis',
        coordinatesGeografis: payload.coordinatesGeografis || [],
        fotoLahan: payload.fotoLahan || [],
        overlapResults: payload.overlapResults || [],
        luasLahan: payload.luasLahan,
        luasManual: payload.luasManual,
        kelilingLahan: payload.kelilingLahan,
        // Documents
        dokumenKTP: payload.dokumenKTP,
        dokumenKK: payload.dokumenKK,
        dokumenKwitansi: payload.dokumenKwitansi,
        dokumenPermohonan: payload.dokumenPermohonan,
        dokumenSKKepalaDesa: payload.dokumenSKKepalaDesa,
        // Team Members
        juruUkur: payload.juruUkur,
        pihakBPD: payload.pihakBPD,
        kepalaDusun: payload.kepalaDusun,
        rtSetempat: payload.rtSetempat,
        // Field Documents
        dokumenBeritaAcara: payload.dokumenBeritaAcara,
        dokumenPernyataanJualBeli: payload.dokumenPernyataanJualBeli,
        dokumenAsalUsul: payload.dokumenAsalUsul,
        dokumenTidakSengketa: payload.dokumenTidakSengketa,
        // Step 3: Results
        status: payload.status,
        alasanStatus: payload.alasanStatus,
        verifikator: payload.verifikator,
        tanggalKeputusan: payload.tanggalKeputusan,
        feedback: payload.feedback,
        // Step 4: Issuance
        dokumenSPPTG: payload.dokumenSPPTG,
        nomorSPPTG: payload.nomorSPPTG,
        tanggalTerbit: payload.tanggalTerbit,
      });
      setCurrentStep(draftData.currentStep);
      if (draftData.lastSaved) {
        const time = new Date(draftData.lastSaved).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSaved(time);
      }
    }
  }, [draftData]);

  // Handle draft errors
  useEffect(() => {
    if (draftError) {
      toast.error(`Gagal memuat draf: ${draftError.message}`);
    }
  }, [draftError]);

  const saveDraftToBackend = useCallback(async (stepOverride?: 1 | 2 | 3 | 4) => {
    if (!draft.id) return;

    // Ensure currentStep is a valid literal type
    const step = stepOverride || (draft.currentStep as 1 | 2 | 3 | 4);
    
    return saveDraftMutation.mutateAsync({
      draftId: draft.id,
      currentStep: step,
      payload: {
        // Step 1: Applicant Data
        namaPemohon: draft.namaPemohon,
        nik: draft.nik,
        tempatLahir: draft.tempatLahir,
        tanggalLahir: draft.tanggalLahir,
        pekerjaan: draft.pekerjaan,
        alamatKTP: draft.alamatKTP,
        persetujuanData: draft.persetujuanData,
        // Step 2: Land Location & Details
        villageId: draft.villageId,
        namaJalan: draft.namaJalan,
        namaGang: draft.namaGang,
        nomorPersil: draft.nomorPersil,
        rtrw: draft.rtrw,
        dusun: draft.dusun,
        kecamatan: draft.kecamatan,
        kabupaten: draft.kabupaten,
        penggunaanLahan: draft.penggunaanLahan,
        tahunAwalGarap: draft.tahunAwalGarap,
        namaKepalaDesa: draft.namaKepalaDesa,
        saksiList: draft.saksiList || [],
        coordinatesGeografis: draft.coordinatesGeografis || [],
        coordinateSystem: draft.coordinateSystem,
        fotoLahan: draft.fotoLahan || [],
        overlapResults: draft.overlapResults || [],
        luasLahan: draft.luasLahan,
        luasManual: draft.luasManual,
        kelilingLahan: draft.kelilingLahan,
        // Documents
        dokumenKTP: draft.dokumenKTP,
        dokumenKK: draft.dokumenKK,
        dokumenKwitansi: draft.dokumenKwitansi,
        dokumenPermohonan: draft.dokumenPermohonan,
        dokumenSKKepalaDesa: draft.dokumenSKKepalaDesa,
        // Team Members
        juruUkur: draft.juruUkur,
        pihakBPD: draft.pihakBPD,
        kepalaDusun: draft.kepalaDusun,
        rtSetempat: draft.rtSetempat,
        // Field Documents
        dokumenBeritaAcara: draft.dokumenBeritaAcara,
        dokumenPernyataanJualBeli: draft.dokumenPernyataanJualBeli,
        dokumenAsalUsul: draft.dokumenAsalUsul,
        dokumenTidakSengketa: draft.dokumenTidakSengketa,
        // Step 3: Results
        status: draft.status,
        alasanStatus: draft.alasanStatus,
        verifikator: draft.verifikator,
        tanggalKeputusan: draft.tanggalKeputusan,
        feedback: draft.feedback,
        // Step 4: Issuance
        dokumenSPPTG: draft.dokumenSPPTG,
        nomorSPPTG: draft.nomorSPPTG,
        tanggalTerbit: draft.tanggalTerbit,
      } as any, // Using 'as any' because payload structure varies by step
    });
  }, [draft, saveDraftMutation]);

  // Auto-save functionality
  useEffect(() => {
    if (!draft.id || isLoadingDraft) return;

    const autoSave = setInterval(() => {
      if (draft.namaPemohon || draft.nik) {
        saveDraftToBackend();
      }
    }, 60000); // Auto-save every minute

    return () => clearInterval(autoSave);
  }, [draft, isLoadingDraft, saveDraftToBackend]);

  const handleNext = async () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!draft.namaPemohon || !draft.nik || draft.nik.length !== 16) {
        toast.error('Harap lengkapi nama dan NIK (16 digit) terlebih dahulu');
        return;
      }
      if (!draft.persetujuanData) {
        toast.error('Harap setujui pernyataan data terlebih dahulu');
        return;
      }
      await saveDraftToBackend(1);
    }

    if (currentStep === 2) {
      if (draft.coordinatesGeografis.length < 3) {
        toast.error('Minimal 3 titik koordinat diperlukan untuk membentuk polygon');
        return;
      }
      await saveDraftToBackend(2);
    }

    if (currentStep === 3) {
      // Validate status and feedback
      if (!draft.status) {
        toast.error('Harap tentukan status keputusan terlebih dahulu');
        return;
      }

      // Validate feedback for rejection/review statuses
      if ((draft.status === 'SPPTG ditolak' || draft.status === 'SPPTG ditinjau ulang') && !draft.feedback?.detailFeedback) {
        toast.error('Feedback wajib diisi untuk status ini');
        return;
      }

      // Save decision first
      if (draft.id) {
        await saveDraftToBackend(3);
      }
      
      // If status requires Step 4, navigate there
      if (draft.status === 'SPPTG terdaftar') {
        const nextStep = 4 as const;
        setCurrentStep(nextStep);
        setDraft((prev) => ({ ...prev, currentStep: nextStep }));
        
        // Save draft with updated step
        if (draft.id) {
          saveDraftToBackend(nextStep);
        }
        
        window.scrollTo(0, 0);
        return;
      }

      // Otherwise, submit directly
      await handleSubmitFromStep3();
      return;
    }

    if (currentStep < 4) {
      // Save current step data before transitioning
      if (draft.id) {
        await saveDraftToBackend(currentStep as 1 | 2 | 3 | 4);
      }

      const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4;
      setCurrentStep(nextStep);
      setDraft((prev) => ({ ...prev, currentStep: nextStep }));
      
      // Save draft with updated step
      if (draft.id) {
        saveDraftToBackend(nextStep);
      }
      
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setDraft((prev) => ({ ...prev, currentStep: currentStep - 1 }));
      window.scrollTo(0, 0);
    }
  };

  const handleSaveDraft = () => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }
    saveDraftToBackend();
  };

  const handleUpdateDraft = (updates: Partial<SubmissionDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  // Auto-save when status is updated
  const prevStatusRef = useRef<StatusSPPTG | undefined>(draft.status);
  useEffect(() => {
    // If status changed and we're on Step 3, immediately save to backend
    if (draft.status && draft.status !== prevStatusRef.current && currentStep === 3 && draft.id) {
      prevStatusRef.current = draft.status;
      // Save immediately when status changes on Step 3
      const timeoutId = setTimeout(() => {
        saveDraftToBackend();
      }, 200);

      // Cleanup: clear timeout if component unmounts or dependencies change
      return () => clearTimeout(timeoutId);
    } else if (draft.status) {
      prevStatusRef.current = draft.status;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.status, currentStep, draft.id]);

  const handleSubmitFromStep3 = async () => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }

    isSubmittingFromStep3.current = true;
    try {
      await submitDraftMutation.mutateAsync({ draftId: draft.id });
      const statusMessages: Record<string, string> = {
        'SPPTG terdata': 'Pengajuan berhasil disimpan dengan status terdata.',
        'SPPTG ditolak': 'Keputusan penolakan berhasil disimpan dan akan dikirim ke pemohon.',
        'SPPTG ditinjau ulang': 'Keputusan tinjau ulang berhasil disimpan dan akan dikirim ke pemohon.',
      };
      const message = statusMessages[draft.status || ''] || 'Pengajuan berhasil disimpan';
      toast.success(message);
      onComplete(draft);
      router.push('/app/pengajuan');
    } catch (error) {
      // Error already handled in mutation
    } finally {
      isSubmittingFromStep3.current = false;
    }
  };

  const canAccessStep4 = draft.status === 'SPPTG terdaftar';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-gray-600 hover:text-gray-900">
                Beranda
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/pengajuan" className="text-gray-600 hover:text-gray-900">
                Pengajuan
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Draft #{draftId}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-gray-900">Pengajuan SPPTG</h1>
            <p className="text-gray-600 mt-1">Draft ID: {draftId}</p>
          </div>
          {lastSaved && (
            <p className="text-sm text-gray-500">
              Draf disimpan pukul {lastSaved}
            </p>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isLocked = step.id === 4 && !canAccessStep4;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors',
                      isCompleted
                        ? 'bg-green-600 border-green-600'
                        : isActive
                          ? 'bg-blue-600 border-blue-600'
                          : isLocked
                            ? 'bg-gray-100 border-gray-300'
                            : 'bg-white border-gray-300'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <Icon
                        className={cn(
                          'w-6 h-6',
                          isActive
                            ? 'text-white'
                            : isLocked
                              ? 'text-gray-400'
                              : 'text-gray-600'
                        )}
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-sm mt-2',
                      isActive
                        ? 'text-blue-700'
                        : isLocked
                          ? 'text-gray-400'
                          : 'text-gray-700'
                    )}
                  >
                    {step.label}
                  </p>
                  {isLocked && (
                    <p className="text-xs text-gray-500 mt-1 text-center max-w-[100px]">
                      Hanya tersedia jika status &quot;SPPTG terdaftar&quot;
                    </p>
                  )}
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-4 transition-colors',
                      currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {isLoadingDraft ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Memuat draf...</span>
          </div>
        ) : (
          <>
            {currentStep === 1 && (
              <Step1DocumentUpload draft={draft} onUpdateDraft={handleUpdateDraft} />
            )}

            {currentStep === 2 && (
              <Step2FieldValidation draft={draft} onUpdateDraft={handleUpdateDraft} />
            )}

            {currentStep === 3 && (
              <Step3Results draft={draft} onUpdateDraft={handleUpdateDraft} />
            )}

            {currentStep === 4 && (
              <Step4Issuance draft={draft} onUpdateDraft={handleUpdateDraft} />
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!draft.id || saveDraftMutation.isPending || isLoadingDraft}
          >
            {saveDraftMutation.isPending ? 'Menyimpan...' : 'Simpan Draf'}
          </Button>

          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrevious}>
              Sebelumnya
            </Button>
          )}

          {currentStep < 4 ? (
            currentStep === 3 && draft.status && draft.status !== 'SPPTG terdaftar' ? (
              <Button
                onClick={handleSubmitFromStep3}
                className="bg-green-600 hover:bg-green-700"
                disabled={isLoadingDraft || saveDraftMutation.isPending || submitDraftMutation.isPending}
              >
                {submitDraftMutation.isPending ? 'Mengirim...' : draft.status === 'SPPTG terdata' ? 'Submit Pengajuan' : 'Submit Keputusan'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isLoadingDraft || saveDraftMutation.isPending}
              >
                {currentStep === 3 && draft.status === 'SPPTG terdaftar'
                  ? 'Lanjut ke Penerbitan SPPTG'
                  : 'Berikutnya'}
              </Button>
            )
          ) : (
            <Button
              onClick={async () => {
                if (!draft.id) {
                  toast.error('Draf belum dimuat');
                  return;
                }

                // Validate Step 4 requirements before submitting
                if (!draft.dokumenSPPTG) {
                  toast.error('Dokumen SPPTG wajib diunggah sebelum diterbitkan');
                  return;
                }

                if (!draft.nomorSPPTG) {
                  toast.error('Nomor SPPTG wajib diisi sebelum diterbitkan');
                  return;
                }

                if (!draft.tanggalTerbit) {
                  toast.error('Tanggal terbit wajib diisi sebelum diterbitkan');
                  return;
                }

                // Save final draft before submitting
                await saveDraftToBackend(4);
                // Submit draft to create submission
                try {
                  const result = await submitDraftMutation.mutateAsync({
                    draftId: draft.id,
                  });
                  onComplete(draft);
                  toast.success('SPPTG berhasil diterbitkan.');
                } catch (error) {
                  // Error already handled in mutation
                }
              }}
              className="bg-green-600 hover:bg-green-700"
              disabled={submitDraftMutation.isPending || saveDraftMutation.isPending}
            >
              {submitDraftMutation.isPending || saveDraftMutation.isPending ? 'Menyimpan...' : 'Terbitkan SPPTG'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
