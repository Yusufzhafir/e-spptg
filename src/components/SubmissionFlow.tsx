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
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Check,
  FileText,
  MapPin,
  ClipboardCheck,
  Award,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Eye,
  Lock,
} from 'lucide-react';
import { StatusSPPTG, SubmissionDraft } from '../types';
import { Step1DocumentUpload } from './submission-steps/Step1DocumentUpload';
import { Step2FieldValidation } from './submission-steps/Step2FieldValidation';
import { Step3Results } from './submission-steps/Step3Results';
import { Step4Issuance } from './submission-steps/Step4Issuance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';
import { useRouter } from 'next/navigation';
import { buildDraftSavePayload } from '@/lib/draft-save-payload';
import { normalizeCoordinateIds } from '@/lib/coordinate-ids';
import { overlapJenisBadgeClassName } from '@/lib/overlap-results';
import { viewerMaxVisibleStep } from '@/lib/viewer-step-access';
import {
  validateStep1Fields,
  validateStep2Fields,
  validateStep4Fields,
  type StepFieldErrors,
} from '@/lib/validation/step-field-errors';
import { useAuthRole } from './AuthRoleProvider';

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

type PersistDraftOptions = {
  silent?: boolean;
};

/** The three things the Viewer's centre-screen dialog can be saying. */
type ViewerNotice =
  | { kind: 'confirm' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function SubmissionFlow({ draftId, onCancel, onComplete }: SubmissionFlowProps) {
  const router = useRouter();
  const { hasRole, user } = useAuthRole();
  const isViewer = hasRole('Viewer');
  const [currentStep, setCurrentStep] = useState(1);
  // How far the berkas itself has actually progressed, as opposed to the step
  // being displayed. A Viewer always lands on Step 1, so the two diverge.
  const [draftProgressStep, setDraftProgressStep] = useState(1);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<StepFieldErrors>({});
  const isSubmittingFromStep3 = useRef(false);
  /**
   * Step 4's "Terbitkan SPPTG" is in flight. Unlike the mutation's own
   * `isPending`, this stays true after the mutation resolves: the redirect that
   * follows is a client navigation, and re-enabling the button for those frames
   * invites a second submission of a draft that is already filed. It is only
   * cleared when the attempt fails and the user is meant to try again.
   */
  const isIssuingSPPTG = useRef(false);
  const [isIssuingSPPTGView, setIsIssuingSPPTGView] = useState(false);

  // Step 2 overlap-confirmation gate (shown before Simpan Draf / Berikutnya)
  const [isStep2ConfirmOpen, setIsStep2ConfirmOpen] = useState(false);
  const [step2ConfirmChecked, setStep2ConfirmChecked] = useState(false);
  const [pendingStep2Action, setPendingStep2Action] = useState<'next' | 'save' | null>(null);

  /**
   * Saving Step 1 is the end of the road for a Viewer — there is no Step 2 to
   * correct things in. A corner toast is too easy to miss for a once-only
   * action, so the confirmation and its outcome are shown centre-screen.
   *
   * Open state is tracked separately from the content: the dialog stays mounted
   * through its close animation, and clearing the content on close would let
   * those frames render the fallback variant — the "Simpan berkas sekarang?"
   * confirmation would flash over the notice the user just dismissed. The last
   * notice therefore stays put until the next one replaces it.
   */
  const [viewerNotice, setViewerNotice] = useState<ViewerNotice | null>(null);
  const [isViewerNoticeOpen, setIsViewerNoticeOpen] = useState(false);

  const showViewerNotice = useCallback((notice: ViewerNotice) => {
    setViewerNotice(notice);
    setIsViewerNoticeOpen(true);
  }, []);

  // Clear the error of a field as soon as it gets updated
  const clearFieldErrorsFor = useCallback(
    (updates: Partial<SubmissionDraft>) => {
      setFieldErrors((prev) => {
        const updatedKeys = Object.keys(updates).filter((key) => key in prev);
        if (updatedKeys.length === 0) return prev;
        const next = { ...prev };
        updatedKeys.forEach((key) => delete next[key]);
        return next;
      });
    },
    []
  );

  // Load draft from backend
  const utils = trpc.useUtils();
  const { data: draftData, isLoading: isLoadingDraft, error: draftError } = trpc.drafts.getById.useQuery({ draftId });

  // Hydrate local state from the backend only once per draft. Background
  // refetches (e.g. on window focus) must never clobber in-progress edits.
  const hydratedDraftIdRef = useRef<number | null>(null);

  // Save draft mutation
  const saveDraftMutation = trpc.drafts.saveStep.useMutation();

  // Submit draft mutation
  const submitDraftMutation = trpc.submissions.submitDraft.useMutation({
    onSuccess: () => {
      // Step 3 (handleSubmitFromStep3) and Step 4 (Terbitkan SPPTG) each own
      // their own outcome message and destination, so this generic pair would
      // only stack a second toast and a competing redirect on top of theirs.
      if (isSubmittingFromStep3.current || isIssuingSPPTG.current) return;
      toast.success('Pengajuan berhasil disimpan');
      router.push(`/app/pengajuan`);
    },
    onError: (error) => {
      toast.error(`Gagal menyimpan pengajuan: ${error.message}`);
      isSubmittingFromStep3.current = false;
    },
  });

  // Overlap check used to gate Simpan Draf / Berikutnya on Step 2
  const checkOverlapsMutation = trpc.submissions.checkOverlapsFromCoordinates.useMutation();

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

  // Viewer tracking: the furthest step they may open, and whether the step on
  // screen is one of the read-only ones (anything past their editable Step 1).
  const viewerMaxStep = viewerMaxVisibleStep(draftProgressStep, draft.status);
  const isReadOnlyStep = isViewer && currentStep > 1;

  // Sync draft from backend (initial hydration only)
  useEffect(() => {
    if (draftData) {
      if (hydratedDraftIdRef.current === draftData.id) return;
      hydratedDraftIdRef.current = draftData.id;
      const payload = (draftData.payload ?? {}) as Partial<SubmissionDraft>;
      const coordinatesGeografis = normalizeCoordinateIds(payload.coordinatesGeografis ?? []);
      const allowedStep = isViewer ? 1 : draftData.currentStep;

      // A Viewer files on their own behalf, so their account *is* the applicant:
      // prefill the identity fields rather than making them retype what the
      // system already holds. Only where the draft has nothing — anything saved
      // wins — and only for Viewers, since for the officer roles the applicant
      // is a citizen at the counter, never the signed-in user.
      const applicant = isViewer
        ? {
            nama: user?.nama ?? '',
            nik: user?.nipNik ?? '',
            nomorHP: user?.nomorHP ?? undefined,
            email: user?.email,
          }
        : { nama: '', nik: '', nomorHP: undefined, email: undefined };

      setDraft({
        id: draftData.id,
        currentStep: allowedStep,
        lastSaved: draftData.lastSaved,
        // Step 1: Applicant Data
        namaPemohon: payload.namaPemohon || applicant.nama,
        nik: payload.nik || applicant.nik,
        tempatLahir: payload.tempatLahir,
        tanggalLahir: payload.tanggalLahir,
        pekerjaan: payload.pekerjaan,
        alamatKTP: payload.alamatKTP,
        nomorHP: payload.nomorHP || applicant.nomorHP,
        email: payload.email || applicant.email,
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
        statusTanah: payload.statusTanah,
        asalPerolehan: payload.asalPerolehan,
        tahunPerolehan: payload.tahunPerolehan,
        namaKepalaDesa: payload.namaKepalaDesa,
        saksiList: payload.saksiList || [],
        coordinateSystem: payload.coordinateSystem || 'geografis',
        coordinatesGeografis,
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
      setCurrentStep(allowedStep);
      setDraftProgressStep(draftData.currentStep);
      if (draftData.lastSaved) {
        const time = new Date(draftData.lastSaved).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSaved(time);
      }
    }
  }, [draftData, isViewer, user]);

  // Handle draft errors
  useEffect(() => {
    if (draftError) {
      toast.error(`Gagal memuat draf: ${draftError.message}`);
    }
  }, [draftError]);

  const normalizeDraftUpdates = useCallback((updates: Partial<SubmissionDraft>) => {
    return Array.isArray(updates.coordinatesGeografis)
      ? {
          ...updates,
          coordinatesGeografis: normalizeCoordinateIds(updates.coordinatesGeografis),
        }
      : updates;
  }, []);

  const persistDraftSnapshot = useCallback(
    async (
      draftSnapshot: SubmissionDraft,
      step: 1 | 2 | 3 | 4,
      options: PersistDraftOptions = {}
    ) => {
      if (!draftSnapshot.id) {
        throw new Error('Draf belum dimuat');
      }

      const result = await saveDraftMutation.mutateAsync({
        draftId: draftSnapshot.id,
        currentStep: step,
        payload: buildDraftSavePayload(draftSnapshot),
      });

      // Keep the getById cache in sync so reopening the draft (within
      // staleTime) shows the saved values instead of a stale snapshot
      utils.drafts.getById.setData({ draftId: draftSnapshot.id }, result);

      const time = new Date(result.lastSaved).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSaved(time);

      if (!options.silent) {
        toast.success('Draf berhasil disimpan');
      }

      return result;
    },
    [saveDraftMutation, utils]
  );

  const saveDraftToBackend = useCallback(
    async (
      stepOverride?: 1 | 2 | 3 | 4,
      options: PersistDraftOptions = {}
    ) => {
      if (!draft.id) return;

      // Ensure currentStep is a valid literal type
      const step = stepOverride || (draft.currentStep as 1 | 2 | 3 | 4);

      try {
        return await persistDraftSnapshot(draft, step, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
        toast.error(`Gagal menyimpan draf: ${message}`);
        throw error;
      }
    },
    [draft, persistDraftSnapshot]
  );

  const persistDraftPatch = useCallback(
    async (
      updates: Partial<SubmissionDraft>,
      step: 1 | 2 | 3 | 4,
      options: PersistDraftOptions = { silent: true }
    ) => {
      if (!draft.id) {
        throw new Error('Draf belum dimuat');
      }

      const normalizedUpdates = normalizeDraftUpdates(updates);
      const nextDraft = { ...draft, ...normalizedUpdates };

      await persistDraftSnapshot(nextDraft, step, options);
      clearFieldErrorsFor(normalizedUpdates);
      setDraft(nextDraft);
    },
    [draft, normalizeDraftUpdates, persistDraftSnapshot, clearFieldErrorsFor]
  );

  // Auto-save functionality
  useEffect(() => {
    // Never write back from a read-only view: the Viewer is only looking at a
    // step someone else owns, and saving would push their stale local copy of
    // the payload over the verifikator's newer work.
    if (!draft.id || isLoadingDraft || isReadOnlyStep) return;

    const autoSave = setInterval(() => {
      if (draft.namaPemohon || draft.nik) {
        void saveDraftToBackend(undefined, { silent: true }).catch(() => undefined);
      }
    }, 60000); // Auto-save every minute

    return () => clearInterval(autoSave);
  }, [draft, isLoadingDraft, isReadOnlyStep, saveDraftToBackend]);

  // Save current step data, advance the step pointer, and persist it.
  const advanceToNextStep = async () => {
    if (currentStep >= 4) return;

    if (draft.id) {
      await saveDraftToBackend(currentStep as 1 | 2 | 3 | 4, { silent: true });
    }

    const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4;
    setCurrentStep(nextStep);
    setDraft((prev) => ({ ...prev, currentStep: nextStep }));

    if (draft.id) {
      void saveDraftToBackend(nextStep, { silent: true }).catch(() => undefined);
    }

    toast.success(
      `Data ${steps[currentStep - 1].label} tersimpan. Lanjut ke tahap ${steps[nextStep - 1].label}.`
    );
    window.scrollTo(0, 0);
  };

  // Persist the draft and navigate away (the actual "Simpan Draf" behavior).
  const performSaveDraft = async () => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }
    try {
      await saveDraftToBackend();
      // After a manual save, return to where the user came from
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/app/pengajuan');
      }
    } catch {
      // Error toast already shown by saveDraftToBackend
    }
  };

  // On Step 2, run the overlap check and require an explicit confirmation
  // before continuing (Berikutnya) or saving (Simpan Draf).
  const runStep2OverlapGate = async (action: 'next' | 'save') => {
    const coords = draft.coordinatesGeografis;

    // Fewer than 3 points → no polygon to check; proceed without gating.
    if (coords.length < 3) {
      if (action === 'next') {
        await advanceToNextStep();
      } else {
        await performSaveDraft();
      }
      return;
    }

    try {
      const overlaps = await checkOverlapsMutation.mutateAsync({
        coordinates: coords.map((c) => ({
          latitude: c.latitude,
          longitude: c.longitude,
        })),
      });

      setDraft((prev) => ({
        ...prev,
        overlapResults: overlaps.map((o) => ({
          kawasanId: o.kawasanId,
          namaKawasan: o.namaKawasan,
          jenisKawasan: o.jenisKawasan,
          sumber: o.sumber,
          luasOverlap: o.luasOverlap,
          percentageOverlap: o.percentageOverlap,
        })),
      }));

      setPendingStep2Action(action);
      setStep2ConfirmChecked(false);
      setIsStep2ConfirmOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast.error(`Gagal mengecek tumpang tindih: ${message}`);
    }
  };

  const handleStep2ConfirmProceed = async () => {
    if (!step2ConfirmChecked) return;
    const action = pendingStep2Action;
    setIsStep2ConfirmOpen(false);
    setPendingStep2Action(null);
    if (action === 'next') {
      await advanceToNextStep();
    } else if (action === 'save') {
      await performSaveDraft();
    }
  };

  /**
   * Viewer's Step 1 save, run only after the centre-screen confirmation.
   * Persists directly rather than through saveDraftToBackend so a failure
   * surfaces in this dialog alone, not also as a corner toast.
   */
  const handleViewerConfirmSave = async () => {
    try {
      await persistDraftSnapshot(draft, 1, { silent: true });
      showViewerNotice({ kind: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      showViewerNotice({ kind: 'error', message });
    }
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      const errors = validateStep1Fields(draft);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        if (isViewer) {
          showViewerNotice({
            kind: 'error',
            message:
              'Masih ada kolom wajib yang belum terisi. Kolom tersebut ditandai merah pada formulir di atas.',
          });
        } else {
          toast.error('Harap lengkapi kolom wajib yang ditandai merah');
        }
        return;
      }
      setFieldErrors({});

      if (isViewer) {
        // Ask first — this save is the Viewer's final action on the berkas.
        showViewerNotice({ kind: 'confirm' });
        return;
      }
      // Non-viewer: saving happens once in the transition block below
    }

    if (currentStep === 2) {
      const errors = validateStep2Fields(draft);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        toast.error('Harap lengkapi kolom wajib yang ditandai merah');
        return;
      }
      setFieldErrors({});

      // Show overlap results + confirmation checkbox before advancing.
      await runStep2OverlapGate('next');
      return;
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
        await saveDraftToBackend(3, { silent: true });
      }

      // If status requires Step 4, navigate there
      if (draft.status === 'SPPTG terdaftar') {
        const nextStep = 4 as const;
        setCurrentStep(nextStep);
        setDraft((prev) => ({ ...prev, currentStep: nextStep }));

        if (draft.id) {
          void saveDraftToBackend(nextStep, { silent: true }).catch(() => undefined);
        }

        toast.success('Keputusan tersimpan. Lanjut ke tahap Terbitkan SPPTG.');
        window.scrollTo(0, 0);
        return;
      }

      // Otherwise, submit directly
      await handleSubmitFromStep3();
      return;
    }

    if (currentStep < 4) {
      await advanceToNextStep();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setFieldErrors({});
      setCurrentStep(currentStep - 1);
      setDraft((prev) => ({ ...prev, currentStep: currentStep - 1 }));
      window.scrollTo(0, 0);
    }
  };

  const handleSaveDraft = async () => {
    if (!draft.id) {
      toast.error('Draf belum dimuat');
      return;
    }
    // On Step 2, gate the save behind the overlap-check confirmation.
    if (currentStep === 2) {
      await runStep2OverlapGate('save');
      return;
    }
    await performSaveDraft();
  };

  const handleUpdateDraft = (updates: Partial<SubmissionDraft>) => {
    const normalizedUpdates = normalizeDraftUpdates(updates);

    clearFieldErrorsFor(normalizedUpdates);
    setDraft((prev) => ({ ...prev, ...normalizedUpdates }));
  };

  // Auto-save when status is updated
  const prevStatusRef = useRef<StatusSPPTG | undefined>(draft.status);
  useEffect(() => {
    // If status changed and we're on Step 3, immediately save to backend
    if (draft.status && draft.status !== prevStatusRef.current && currentStep === 3 && draft.id) {
      prevStatusRef.current = draft.status;
      // Save immediately when status changes on Step 3
      const timeoutId = setTimeout(() => {
        void saveDraftToBackend(undefined, { silent: true }).catch(() => undefined);
      }, 200);

      // Cleanup: clear timeout if component unmounts or dependencies change
      return () => clearTimeout(timeoutId);
    } else if (draft.status) {
      prevStatusRef.current = draft.status;
    }
  }, [draft.status, currentStep, draft.id, saveDraftToBackend]);

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

  /**
   * Viewer navigation between the steps they may look at. Purely local: it must
   * not touch `draft.currentStep`, which is the berkas's real progress pointer
   * and belongs to the officers processing it.
   */
  const goToViewerStep = (nextStep: number) => {
    if (nextStep < 1 || nextStep > viewerMaxStep) return;
    setFieldErrors({});
    setCurrentStep(nextStep);
    window.scrollTo(0, 0);
  };

  /** Why a stage is out of reach, or null when it is open. */
  const lockedHint = (stepId: number): string | null => {
    if (isViewer) {
      if (stepId <= viewerMaxStep) return null;
      return stepId === 4
        ? 'Tahap penerbitan diproses oleh petugas'
        : 'Terbuka setelah petugas menyelesaikan tahap ini';
    }
    if (stepId === 4 && !canAccessStep4) {
      return 'Hanya tersedia jika status "SPPTG terdaftar"';
    }
    return null;
  };

  // Below `sm` the hints move out of the columns and are listed under the row —
  // four of them side by side is what used to force the stepper off-screen.
  // Duplicates collapse because consecutive locked stages share a reason.
  const mobileLockedHints = Array.from(
    new Set(steps.map((step) => lockedHint(step.id)).filter((hint): hint is string => hint !== null))
  );

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
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        {/* Sized down rather than scrolled on phones: the four stages are the
            page's orientation, so a stepper you have to swipe sideways to read
            defeats the point. Everything below scales at `sm`. */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 min-w-0">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            const hint = lockedHint(step.id);
            const isLocked = hint !== null;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1 px-0.5">
                  <div
                    className={cn(
                      'w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center border-2 transition-colors',
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
                      <Check className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    ) : (
                      <Icon
                        className={cn(
                          'w-4 h-4 sm:w-6 sm:h-6',
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
                      'text-[10px] leading-tight text-center mt-1.5 sm:text-sm sm:mt-2',
                      isActive
                        ? 'text-blue-700'
                        : isLocked
                          ? 'text-gray-400'
                          : 'text-gray-700'
                    )}
                  >
                    {step.label}
                  </p>
                  {hint && (
                    <p className="hidden sm:block text-xs text-gray-500 mt-1 text-center max-w-[100px]">
                      {hint}
                    </p>
                  )}
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      // Grows into whatever the labels leave over, but never
                      // collapses to nothing on the narrowest phones.
                      'flex-1 min-w-3 sm:min-w-0 h-0.5 mx-1 sm:mx-4 transition-colors',
                      currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {mobileLockedHints.length > 0 && (
          <ul className="sm:hidden mt-3 space-y-1 border-t border-gray-100 pt-3">
            {mobileLockedHints.map((hint) => (
              <li key={hint} className="flex gap-1.5 text-xs leading-snug text-gray-500">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        )}
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
            {isReadOnlyStep && (
              <div className="mb-6 flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold">Mode lihat saja</p>
                  <p className="mt-1 leading-relaxed">
                    Tahap ini dikerjakan oleh petugas desa. Anda dapat memantau
                    isian dan peta di bawah, tetapi tidak dapat mengubahnya.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <Step1DocumentUpload
                draft={draft}
                onUpdateDraft={handleUpdateDraft}
                onPersistDraftPatch={(updates, options) =>
                  persistDraftPatch(updates, 1, options)
                }
                errors={fieldErrors}
              />
            )}

            {currentStep === 2 && (
              <Step2FieldValidation
                draft={draft}
                onUpdateDraft={handleUpdateDraft}
                onPersistDraftPatch={(updates, options) =>
                  persistDraftPatch(updates, 2, options)
                }
                errors={fieldErrors}
                readOnly={isReadOnlyStep}
              />
            )}

            {currentStep === 3 && (
              <Step3Results
                draft={draft}
                onUpdateDraft={handleUpdateDraft}
                onPersistDraftPatch={(updates, options) =>
                  persistDraftPatch(updates, 3, options)
                }
                readOnly={isReadOnlyStep}
              />
            )}

            {currentStep === 4 && (
              <Step4Issuance
                draft={draft}
                onUpdateDraft={handleUpdateDraft}
                onPersistDraftPatch={(updates, options) =>
                  persistDraftPatch(updates, 4, options)
                }
                errors={fieldErrors}
              />
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 p-4">
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>

        {isViewer ? (
          /* The Viewer only ever acts on Step 1; on the tracking steps the bar
             is pure navigation, with no save of any kind. */
          <div className="flex flex-wrap gap-3">
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => goToViewerStep(currentStep - 1)}>
                Sebelumnya
              </Button>
            )}

            {currentStep === 1 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={!draft.id || saveDraftMutation.isPending || isLoadingDraft}
                >
                  {saveDraftMutation.isPending ? 'Menyimpan...' : 'Simpan Draf'}
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={isLoadingDraft || saveDraftMutation.isPending}
                >
                  Simpan Berkas
                </Button>
              </>
            )}

            {currentStep < viewerMaxStep && (
              <Button variant="outline" onClick={() => goToViewerStep(currentStep + 1)}>
                Lihat Tahap {steps[currentStep].label}
              </Button>
            )}
          </div>
        ) : (
        <div className="flex flex-wrap gap-3">
          {/* Distinct from 'Simpan Berkas': this parks the work in progress and
              leaves the page, with no confirmation and no finality. */}
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={
              !draft.id ||
              saveDraftMutation.isPending ||
              isLoadingDraft ||
              checkOverlapsMutation.isPending
            }
          >
            {saveDraftMutation.isPending
              ? 'Menyimpan...'
              : currentStep === 2 && checkOverlapsMutation.isPending
                ? 'Mengecek...'
                : 'Simpan Draf'}
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
                disabled={isLoadingDraft || saveDraftMutation.isPending || checkOverlapsMutation.isPending}
              >
                {currentStep === 2 && checkOverlapsMutation.isPending
                  ? 'Mengecek...'
                  : currentStep === 3 && draft.status === 'SPPTG terdaftar'
                    ? 'Lanjut ke Penerbitan SPPTG'
                    : 'Berikutnya'}
              </Button>
            )
          ) : (
            <Button
              onClick={async () => {
                if (!draft.id || isIssuingSPPTG.current) {
                  if (!draft.id) toast.error('Draf belum dimuat');
                  return;
                }

                // Validate Step 4 requirements before submitting
                const errors = validateStep4Fields(draft);
                if (Object.keys(errors).length > 0) {
                  setFieldErrors(errors);
                  toast.error('Harap lengkapi kolom wajib yang ditandai merah');
                  return;
                }
                setFieldErrors({});

                isIssuingSPPTG.current = true;
                setIsIssuingSPPTGView(true);
                try {
                  // Silent: issuing is one action to the user, and its outcome
                  // is announced once, on the dashboard it lands on.
                  await saveDraftToBackend(4, { silent: true });
                  await submitDraftMutation.mutateAsync({ draftId: draft.id });
                  // Navigates to the dashboard, which raises the single success
                  // toast once it is actually on screen.
                  onComplete(draft);
                } catch {
                  // The mutation already reported why; let them try again.
                  isIssuingSPPTG.current = false;
                  setIsIssuingSPPTGView(false);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
              disabled={
                isIssuingSPPTGView ||
                submitDraftMutation.isPending ||
                saveDraftMutation.isPending
              }
            >
              {isIssuingSPPTGView || submitDraftMutation.isPending || saveDraftMutation.isPending
                ? 'Menyimpan...'
                : 'Terbitkan SPPTG'}
            </Button>
          )}
        </div>
        )}
      </div>

      {/* Viewer: confirmation and outcome for the one action they have. */}
      <Dialog
        open={isViewerNoticeOpen}
        onOpenChange={(open) => {
          if (open) return;
          // A saved berkas is final for the Viewer — send them back to the list
          // instead of leaving them on a form they can no longer act on.
          const wasSuccess = viewerNotice?.kind === 'success';
          setIsViewerNoticeOpen(false);
          if (wasSuccess) router.push('/app/pengajuan');
        }}
      >
        <DialogContent className="sm:max-w-[460px]" showCloseButton={false}>
          <div className="flex flex-col items-center px-2 py-4 text-center">
            {viewerNotice?.kind === 'success' ? (
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </span>
            ) : viewerNotice?.kind === 'error' ? (
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-9 w-9 text-red-600" />
              </span>
            ) : (
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <HelpCircle className="h-9 w-9 text-blue-600" />
              </span>
            )}

            <DialogHeader className="gap-2">
              <DialogTitle className="text-center text-xl">
                {viewerNotice?.kind === 'success'
                  ? 'Berkas berhasil disimpan'
                  : viewerNotice?.kind === 'error'
                    ? 'Berkas belum tersimpan'
                    : 'Simpan berkas sekarang?'}
              </DialogTitle>
              <DialogDescription className="text-center text-base leading-relaxed text-gray-600">
                {viewerNotice?.kind === 'success'
                  ? 'Berkas Anda sudah masuk ke sistem dan akan diperiksa oleh petugas desa. Anda dapat memantau perkembangannya di daftar pengajuan.'
                  : viewerNotice?.kind === 'error'
                    ? viewerNotice.message
                    : 'Pastikan data pemohon dan seluruh dokumen sudah benar. Setelah disimpan, berkas diteruskan ke petugas desa dan tahap berikutnya bukan lagi wewenang Anda.'}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              {viewerNotice?.kind === 'confirm' ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setIsViewerNoticeOpen(false)}
                    disabled={saveDraftMutation.isPending}
                  >
                    Periksa Lagi
                  </Button>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
                    onClick={handleViewerConfirmSave}
                    disabled={saveDraftMutation.isPending}
                  >
                    {saveDraftMutation.isPending ? 'Menyimpan...' : 'Ya, Simpan Berkas'}
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const wasSuccess = viewerNotice?.kind === 'success';
                    setIsViewerNoticeOpen(false);
                    if (wasSuccess) router.push('/app/pengajuan');
                  }}
                >
                  {viewerNotice?.kind === 'success' ? 'Ke Daftar Pengajuan' : 'Mengerti'}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: overlap-check result + confirmation before Simpan/Berikutnya */}
      <Dialog open={isStep2ConfirmOpen} onOpenChange={setIsStep2ConfirmOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Hasil Cek Tumpang Tindih</DialogTitle>
            <DialogDescription>
              Periksa hasil pengecekan overlap terhadap kawasan Non-SPPTG dan SPPTG
              eksisting sebelum melanjutkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(draft.overlapResults?.length ?? 0) === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-900">
                  ✓ Tidak ada tumpang tindih terdeteksi
                </p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <p className="text-orange-900">
                      <strong>
                        Ditemukan {draft.overlapResults!.length} tumpang tindih
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table className="min-w-200">
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Nama Kawasan</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead>Sumber</TableHead>
                        <TableHead>Luas Overlap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.overlapResults!.map((overlap, index) => (
                        <TableRow key={index}>
                          <TableCell>{overlap.namaKawasan}</TableCell>
                          <TableCell>
                            <Badge className={overlapJenisBadgeClassName(overlap)}>
                              {overlap.jenisKawasan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {overlap.sumber === 'Submission'
                                ? 'SPPTG Eksisting'
                                : 'Kawasan Non-SPPTG'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {Math.round(overlap.luasOverlap).toLocaleString('id-ID')} m²
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer">
              <Checkbox
                checked={step2ConfirmChecked}
                onCheckedChange={(value) => setStep2ConfirmChecked(value === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-700">
                Saya sudah memeriksa hasil cek tumpang tindih dan yakin untuk
                melanjutkan.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStep2ConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              onClick={handleStep2ConfirmProceed}
              disabled={!step2ConfirmChecked || saveDraftMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {pendingStep2Action === 'save' ? 'Simpan Draf' : 'Lanjutkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
