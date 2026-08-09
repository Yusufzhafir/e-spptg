'use client';

import { useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { Button } from './ui/button';

/**
 * "Lihat" and "Unduh" for a document that is already stored.
 *
 * Both go through `documents.getSignedDownloadUrl`, never the raw S3 URL: the
 * bucket is private, and that procedure is where the row-level and
 * document-category checks live. The only difference between the two is the
 * `disposition` it signs the link with — `inline` lets the browser render the
 * PDF or image in a new tab, `attachment` makes it save to disk under the
 * original filename.
 *
 * Renders nothing without a `documentId`: an upload still in flight, or an old
 * draft payload written before the id was recorded, has nothing to point at.
 */
export function DocumentActions({
  documentId,
  className,
}: {
  documentId?: number;
  className?: string;
}) {
  const [pending, setPending] = useState<'inline' | 'attachment' | null>(null);
  const getSignedUrl = trpc.documents.getSignedDownloadUrl.useMutation();

  if (!documentId) return null;

  const openDocument = async (disposition: 'inline' | 'attachment') => {
    setPending(disposition);
    try {
      const { signedUrl } = await getSignedUrl.mutateAsync({ documentId, disposition });

      if (disposition === 'inline') {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      // A signed attachment link already carries the Content-Disposition that
      // makes the browser save it, so a plain anchor click downloads without
      // navigating away or leaving an empty tab behind.
      const link = document.createElement('a');
      link.href = signedUrl;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : disposition === 'inline'
            ? 'Gagal membuka dokumen.'
            : 'Gagal mengunduh dokumen.'
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={className ?? 'flex items-center gap-1'}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Lihat dokumen"
        aria-label="Lihat dokumen"
        disabled={pending !== null}
        onClick={() => void openDocument('inline')}
        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
      >
        {pending === 'inline' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Unduh dokumen"
        aria-label="Unduh dokumen"
        disabled={pending !== null}
        onClick={() => void openDocument('attachment')}
        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
      >
        {pending === 'attachment' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
