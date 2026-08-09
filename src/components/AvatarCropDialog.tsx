'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

/** Side of the exported square, in pixels. Fixed, whatever the screen size. */
const OUTPUT_SIZE = 512;
/** Bounds for the on-screen crop frame; the actual size is measured. */
const MIN_VIEWPORT = 200;
const MAX_VIEWPORT = 288;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

export type CroppedAvatar = { fileData: string; mimeType: 'image/jpeg' };

/**
 * The crop surface itself: one image, panned and zoomed inside a square frame.
 *
 * Mounted with `key={image.src}` by the dialog below, so a newly picked photo
 * starts from a clean zoom and offset without an effect resetting them.
 *
 * The maths is one transform, applied twice. `baseScale` maps the image so its
 * shorter side exactly fills the frame at zoom 1 (`cover`), `offset` slides it,
 * and `clampOffset` stops either edge being dragged inside the frame so the
 * result can never contain blank corners. Drawing to the canvas divides by the
 * on-screen ratio to redo the same crop at full resolution.
 */
function CropSurface({
  image,
  onCropped,
  isSaving,
  onCancel,
}: {
  image: HTMLImageElement;
  onCropped: (result: CroppedAvatar) => void;
  isSaving: boolean;
  onCancel: () => void;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState(MAX_VIEWPORT);
  const dragStart = useRef<{ pointerX: number; pointerY: number; offset: Offset } | null>(
    null
  );

  /**
   * The frame follows the dialog's width, so it stays comfortably inside a
   * phone screen and grows back to full size on a tablet or desktop. Measured
   * rather than guessed from a breakpoint, and measured through a
   * ResizeObserver so a rotated phone re-fits without reopening the dialog.
   */
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport(
        Math.max(MIN_VIEWPORT, Math.min(MAX_VIEWPORT, entry.contentRect.width))
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const baseScale = Math.max(
    viewport / image.naturalWidth,
    viewport / image.naturalHeight
  );
  const displayWidth = image.naturalWidth * baseScale * zoom;
  const displayHeight = image.naturalHeight * baseScale * zoom;

  /** Keep both axes covered: the image may never be dragged inside the frame. */
  const clampOffset = useCallback(
    (next: Offset): Offset => {
      const maxX = Math.max(0, (displayWidth - viewport) / 2);
      const maxY = Math.max(0, (displayHeight - viewport) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [displayWidth, displayHeight, viewport]
  );

  // Clamped while rendering rather than corrected by an effect: zooming back
  // out shrinks the allowed range, and re-clamping here keeps the stored offset
  // free to expand again when the user zooms back in.
  const view = clampOffset(offset);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, offset: view };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    setOffset(
      clampOffset({
        x: start.offset.x + (event.clientX - start.pointerX),
        y: start.offset.y + (event.clientY - start.pointerY),
      })
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSave = () => {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Same transform as the preview, scaled from the on-screen frame up to the
    // exported square — so what was framed is exactly what is saved.
    const ratio = OUTPUT_SIZE / viewport;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      (OUTPUT_SIZE - displayWidth * ratio) / 2 + view.x * ratio,
      (OUTPUT_SIZE - displayHeight * ratio) / 2 + view.y * ratio,
      displayWidth * ratio,
      displayHeight * ratio
    );

    // JPEG, always: a photo re-encodes far smaller than PNG, and the upload has
    // a 2 MB ceiling. Transparency is irrelevant inside a filled square.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCropped({ fileData: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' });
  };

  return (
    <>
      {/* The measured box: the frame below never exceeds this width. */}
      <div ref={measureRef} className="flex w-full flex-col items-center gap-4">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // Pointer events rather than mouse events, so one implementation
          // covers mouse, pen and finger. `touch-none` is what makes dragging
          // work on a phone at all: without it the browser claims the gesture
          // for scrolling and the photo never moves.
          className="relative touch-none select-none overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-100"
          style={{ width: viewport, height: viewport, cursor: 'grab' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local
              object URL positioned by hand; next/image would fight the drag. */}
          <img
            src={image.src}
            alt="Pratinjau foto profil"
            draggable={false}
            className="absolute max-w-none"
            style={{
              width: displayWidth,
              height: displayHeight,
              left: (viewport - displayWidth) / 2 + view.x,
              top: (viewport - displayHeight) / 2 + view.y,
            }}
          />
        </div>

        <div className="flex w-full items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-gray-500" />
          {/* `h-6` gives the thumb a finger-sized hit area on a phone; the
              default range track is around 4px tall and hard to grab. */}
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Perbesaran foto"
            className="h-6 w-full accent-blue-600"
          />
        </div>

        <p className="text-center text-xs text-gray-500">
          Geser foto untuk mengatur posisi, lalu atur perbesaran.
        </p>
      </div>

      <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Batal
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Menyimpan...' : 'Simpan Foto'}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Square-crop editor for a profile photo.
 *
 * A profile photo is displayed in a circle everywhere, so a non-square image
 * would be cropped by the browser at whatever point `object-cover` chose —
 * usually through the middle of someone's face. This gives that decision back
 * to the person: drag to move, slide to zoom, and the exported file is always
 * exactly 1:1.
 */
export function AvatarCropDialog({
  file,
  open,
  onOpenChange,
  onCropped,
  isSaving = false,
}: {
  /** The picked file. Null while the dialog is closed. */
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropped: (result: CroppedAvatar) => void;
  isSaving?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ file: File; element: HTMLImageElement } | null>(
    null
  );

  useEffect(() => {
    if (!file) return;

    // Object URLs are a manual resource: without the revoke the blob is held for
    // the lifetime of the document, once per photo the user previews.
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => setLoaded({ file, element });
    element.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Derived rather than cleared on the way out: the previous photo must not
  // flash inside the frame while a newly picked one is still decoding.
  const image = loaded && loaded.file === file ? loaded.element : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Atur Posisi Foto</DialogTitle>
          <DialogDescription>
            Geser untuk memindahkan dan atur perbesaran. Foto akan disimpan
            dengan rasio 1:1.
          </DialogDescription>
        </DialogHeader>

        {image ? (
          <CropSurface
            // Fresh zoom and offset per photo, without an effect to reset them.
            key={image.src}
            image={image}
            onCropped={onCropped}
            isSaving={isSaving}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memuat foto...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
