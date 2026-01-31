/**
 * PDF Download Button Component
 * 
 * A reusable button component that generates and downloads SPPTG PDFs.
 * Uses dynamic imports to avoid bloating the main bundle.
 * 
 * Usage:
 * ```tsx
 * <PDFDownloadButton
 *   data={pdfData}
 *   config={{ includeWitnesses: true, includeMap: true }}
 *   filename="SPPTG_001_2025.pdf"
 * >
 *   Download SPPTG
 * </PDFDownloadButton>
 * ```
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePDFGenerator } from '@/hooks/usePDFGenerator';
import type { SPPTGPDFData, PDFGenerationConfig, PDFGenerationResult } from './types';

interface PDFDownloadButtonProps {
  /** Data to fill in the PDF */
  data: SPPTGPDFData;
  /** Configuration for PDF generation */
  config?: PDFGenerationConfig;
  /** Button text/content */
  children?: React.ReactNode;
  /** Callback when PDF is successfully generated */
  onGenerate?: (result: PDFGenerationResult) => void;
  /** Callback when download starts */
  onDownload?: () => void;
  /** Additional CSS class for the button */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Filename for the downloaded PDF (without .pdf extension) */
  filename?: string;
  /** Button variant */
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show icon */
  showIcon?: boolean;
}

export const PDFDownloadButton: React.FC<PDFDownloadButtonProps> = ({
  data,
  config,
  children = 'Download PDF',
  onGenerate,
  onDownload,
  className,
  disabled = false,
  filename,
  variant = 'default',
  size = 'default',
  showIcon = true,
}) => {
  const { generatePDF, isGenerating, error, clearError } = usePDFGenerator();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Clear error when component unmounts
  React.useEffect(() => {
    return () => {
      // Cleanup blob URL if exists
      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [generatedUrl]);

  // Show error toast
  React.useEffect(() => {
    if (error) {
      toast.error(`Gagal membuat PDF: ${error.message}`);
      clearError();
    }
  }, [error, clearError]);

  const handleDownload = useCallback(async () => {
    try {
      // Generate the PDF
      const result = await generatePDF(data, config);
      setGeneratedUrl(result.url);

      // Call onGenerate callback if provided
      if (onGenerate) {
        onGenerate(result);
      }

      // Create download link
      const link = document.createElement('a');
      link.href = result.url;
      link.download = filename ? `${filename}.pdf` : `SPPTG_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Call onDownload callback if provided
      if (onDownload) {
        onDownload();
      }

      toast.success('PDF berhasil diunduh');
    } catch (err) {
      // Error is already handled by the hook via toast
      console.error('PDF download error:', err);
    }
  }, [data, config, filename, generatePDF, onGenerate, onDownload]);

  const handlePreview = useCallback(async () => {
    try {
      // Generate the PDF
      const result = await generatePDF(data, config);
      setGeneratedUrl(result.url);

      // Call onGenerate callback if provided
      if (onGenerate) {
        onGenerate(result);
      }

      // Open preview in new window
      window.open(result.url, '_blank');
    } catch (err) {
      console.error('PDF preview error:', err);
    }
  }, [data, config, generatePDF, onGenerate]);

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleDownload}
        disabled={disabled || isGenerating}
        className={className}
        variant={variant}
        size={size}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Membuat PDF...
          </>
        ) : (
          <>
            {showIcon && <Download className="w-4 h-4 mr-2" />}
            {children}
          </>
        )}
      </Button>

      {/* Preview button - only show when not generating */}
      {!isGenerating && (
        <Button
          onClick={handlePreview}
          disabled={disabled}
          variant="outline"
          size={size}
        >
          {showIcon && <FileText className="w-4 h-4 mr-2" />}
          Preview
        </Button>
      )}
    </div>
  );
};

export default PDFDownloadButton;
