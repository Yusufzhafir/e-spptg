import { useState, useEffect, useCallback } from 'react';
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
import { SubmissionDraft } from '../types';
import { Step1DocumentUpload } from './submission-steps/Step1DocumentUpload';
import { Step2FieldValidation } from './submission-steps/Step2FieldValidation';
import { Step3Results } from './submission-steps/Step3Results';
import { Step4Issuance } from './submission-steps/Step4Issuance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';
import { useRouter } from 'next/navigation';

interface SubmissionFlowProps {
  submissionId?: string;
  onCancel: () => void;
  onComplete: (draft: SubmissionDraft) => void;
}

const steps = [
  { id: 1, label: 'Berkas', icon: FileText },
  { id: 2, label: 'Lapangan', icon: MapPin },
  { id: 3, label: 'Hasil', icon: ClipboardCheck },
  { id: 4, label: 'Terbitkan SPPTG', icon: Award },
];

export function SubmissionFlow({ submissionId, onCancel, onComplete }: SubmissionFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [lastSaved, setLastSaved] = useState<string>('');

  // Load draft from backend
  const { data: draftData, isLoading: isLoadingDraft, error: draftError } = trpc.drafts.getOrCreateCurrent.useQuery();
  
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
      toast.success('Pengajuan berhasil disimpan');
      router.push(`/pengajuan/${data.submissionId}`);
    },
    onError: (error) => {
      toast.error(`Gagal menyimpan pengajuan: ${error.message}`);
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
        namaPemohon: payload.namaPemohon || '',
        nik: payload.nik || '',
        persetujuanData: payload.persetujuanData || false,
        saksiList: payload.saksiList || [],
        coordinateSystem: payload.coordinateSystem || 'geografis',
        coordinatesGeografis: payload.coordinatesGeografis || [],
        fotoLahan: payload.fotoLahan || [],
        overlapResults: payload.overlapResults || [],
        dokumenKTP: payload.dokumenKTP,
        dokumenKK: payload.dokumenKK,
        dokumenKwitansi: payload.dokumenKwitansi,
        dokumenPermohonan: payload.dokumenPermohonan,
        dokumenSKKepalaDesa: payload.dokumenSKKepalaDesa,
        juruUkur: payload.juruUkur,
        pihakBPD: payload.pihakBPD,
        kepalaDusun: payload.kepalaDusun,
        rtSetempat: payload.rtSetempat,
        luasLahan: payload.luasLahan,
        kelilingLahan: payload.kelilingLahan,
        dokumenBeritaAcara: payload.dokumenBeritaAcara,
        dokumenPernyataanJualBeli: payload.dokumenPernyataanJualBeli,
        dokumenAsalUsul: payload.dokumenAsalUsul,
        dokumenTidakSengketa: payload.dokumenTidakSengketa,
        status: payload.status,
        alasanStatus: payload.alasanStatus,
        verifikator: payload.verifikator,
        tanggalKeputusan: payload.tanggalKeputusan,
        feedback: payload.feedback,
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

  // Auto-save functionality
  useEffect(() => {
    if (!draft.id || isLoadingDraft) return;

    const autoSave = setInterval(() => {
      if (draft.namaPemohon || draft.nik) {
        saveDraftToBackend();
      }
    }, 60000); // Auto-save every minute

    return () => clearInterval(autoSave);
  }, [draft, isLoadingDraft]);

  const saveDraftToBackend = useCallback(() => {
    if (!draft.id) return;
    
    // Ensure currentStep is a valid literal type
    const step = draft.currentStep as 1 | 2 | 3 | 4;
    saveDraftMutation.mutate({
      draftId: draft.id,
      currentStep: step,
      payload: {
        namaPemohon: draft.namaPemohon,
        nik: draft.nik,
        persetujuanData: draft.persetujuanData,
        saksiList: draft.saksiList || [],
        coordinatesGeografis: draft.coordinatesGeografis || [],
        fotoLahan: draft.fotoLahan || [],
        overlapResults: draft.overlapResults || [],
        dokumenKTP: draft.dokumenKTP,
        dokumenKK: draft.dokumenKK,
        dokumenKwitansi: draft.dokumenKwitansi,
        dokumenPermohonan: draft.dokumenPermohonan,
        dokumenSKKepalaDesa: draft.dokumenSKKepalaDesa,
        juruUkur: draft.juruUkur,
        pihakBPD: draft.pihakBPD,
        kepalaDusun: draft.kepalaDusun,
        rtSetempat: draft.rtSetempat,
        luasLahan: draft.luasLahan,
        kelilingLahan: draft.kelilingLahan,
        dokumenBeritaAcara: draft.dokumenBeritaAcara,
        dokumenPernyataanJualBeli: draft.dokumenPernyataanJualBeli,
        dokumenAsalUsul: draft.dokumenAsalUsul,
        dokumenTidakSengketa: draft.dokumenTidakSengketa,
        status: draft.status,
        alasanStatus: draft.alasanStatus,
        verifikator: draft.verifikator,
        tanggalKeputusan: draft.tanggalKeputusan,
        feedback: draft.feedback,
        dokumenSPPTG: draft.dokumenSPPTG,
        nomorSPPTG: draft.nomorSPPTG,
        tanggalTerbit: draft.tanggalTerbit,
      } as any, // Using 'as any' because payload structure varies by step
    });
  }, [draft, saveDraftMutation]);

  const handleNext = () => {
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
    }

    if (currentStep === 2) {
      if (draft.coordinatesGeografis.length < 3) {
        toast.error('Minimal 3 titik koordinat diperlukan untuk membentuk polygon');
        return;
      }
    }

    if (currentStep === 3) {
      if (!draft.status) {
        toast.error('Harap tentukan status keputusan terlebih dahulu');
        return;
      }
      if ((draft.status === 'SPPTG ditolak' || draft.status === 'SPPTG ditinjau ulang') && !draft.feedback?.detailFeedback) {
        toast.error('Feedback wajib diisi untuk status ini');
        return;
      }
    }

    if (currentStep < 4) {
      const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4;
      setCurrentStep(nextStep);
      setDraft((prev) => ({ ...prev, currentStep: nextStep }));
      
      // Save draft with updated step
      if (draft.id) {
        saveDraftMutation.mutate({
          draftId: draft.id,
          currentStep: nextStep,
          payload: {
            namaPemohon: draft.namaPemohon,
            nik: draft.nik,
            persetujuanData: draft.persetujuanData,
            saksiList: draft.saksiList || [],
            coordinatesGeografis: draft.coordinatesGeografis || [],
            fotoLahan: draft.fotoLahan || [],
            overlapResults: draft.overlapResults || [],
            dokumenKTP: draft.dokumenKTP,
            dokumenKK: draft.dokumenKK,
            dokumenKwitansi: draft.dokumenKwitansi,
            dokumenPermohonan: draft.dokumenPermohonan,
            dokumenSKKepalaDesa: draft.dokumenSKKepalaDesa,
            juruUkur: draft.juruUkur,
            pihakBPD: draft.pihakBPD,
            kepalaDusun: draft.kepalaDusun,
            rtSetempat: draft.rtSetempat,
            luasLahan: draft.luasLahan,
            kelilingLahan: draft.kelilingLahan,
            dokumenBeritaAcara: draft.dokumenBeritaAcara,
            dokumenPernyataanJualBeli: draft.dokumenPernyataanJualBeli,
            dokumenAsalUsul: draft.dokumenAsalUsul,
            dokumenTidakSengketa: draft.dokumenTidakSengketa,
            status: draft.status,
            alasanStatus: draft.alasanStatus,
            verifikator: draft.verifikator,
            tanggalKeputusan: draft.tanggalKeputusan,
            feedback: draft.feedback,
            dokumenSPPTG: draft.dokumenSPPTG,
            nomorSPPTG: draft.nomorSPPTG,
            tanggalTerbit: draft.tanggalTerbit,
          } as any, // Using 'as any' because payload structure varies by step
        });
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

  const canAccessStep4 = draft.status === 'SPPTG terdaftar';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-gray-600 hover:text-gray-900">
                Beranda
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-gray-600 hover:text-gray-900">
                Pengajuan
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{submissionId || 'Baru'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-gray-900">Pengajuan SPPTG</h1>
            {submissionId && (
              <p className="text-gray-600 mt-1">ID Pengajuan: {submissionId}</p>
            )}
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
            <Button 
              onClick={handleNext} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isLoadingDraft || saveDraftMutation.isPending}
            >
              {currentStep === 3 && draft.status === 'SPPTG terdaftar'
                ? 'Lanjut ke Penerbitan SPPTG'
                : 'Berikutnya'}
            </Button>
          ) : (
            <Button
              onClick={async () => {
                if (!draft.nomorSPPTG || !draft.tanggalTerbit || !draft.dokumenSPPTG) {
                  toast.error('Harap lengkapi semua field penerbitan SPPTG');
                  return;
                }
                if (!draft.id) {
                  toast.error('Draf belum dimuat');
                  return;
                }
                // Save final draft before submitting
                await saveDraftMutation.mutateAsync({
                  draftId: draft.id,
                  currentStep: 4,
                  payload: {
                    ...draft,
                    currentStep: 4,
                  } as any,
                });
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
