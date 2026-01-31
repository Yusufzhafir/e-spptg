/**
 * usePDFGenerator Hook
 * 
 * This hook provides a convenient way to generate SPPTG PDFs
 * using the React-PDF library with dynamic imports to avoid
 * bundle bloat.
 * 
 * Usage:
 * ```tsx
 * const { generatePDF, isGenerating, error } = usePDFGenerator();
 * 
 * const handleDownload = async () => {
 *   const result = await generatePDF(data);
 *   // result contains blob, url, size, and base64
 * };
 * ```
 */

'use client';

import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SPPTGPDFData, PDFGenerationConfig, PDFGenerationResult } from '@/components/pdf/types';

interface UsePDFGeneratorReturn {
  /** Generate PDF from data - returns blob, url, size, and base64 */
  generatePDF: (
    data: SPPTGPDFData,
    config?: PDFGenerationConfig
  ) => Promise<PDFGenerationResult>;
  /** Whether PDF is currently being generated */
  isGenerating: boolean;
  /** Error if generation failed */
  error: Error | null;
  /** Clear any error */
  clearError: () => void;
}

/**
 * Generate PDF document element dynamically
 */
async function createPDFDocument(
  data: SPPTGPDFData,
  config?: PDFGenerationConfig
): Promise<React.ReactElement> {
  // Dynamically import to avoid bundling PDF components on initial load
  const { SPPTGDocument } = await import('@/components/pdf/SPPTGDocument');
  const React = await import('react');
  
  const element = React.createElement(SPPTGDocument, { data, config });
  return element as React.ReactElement;
}

/**
 * Hook for generating SPPTG PDFs
 * 
 * @returns Object with generate function, loading state, and error handling
 */
export function usePDFGenerator(): UsePDFGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generatePDF = useCallback(async (
    data: SPPTGPDFData,
    config?: PDFGenerationConfig
  ): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    setError(null);

    try {
      // Create PDF document element
      const document = await createPDFDocument(data, config);

      // Generate PDF blob using react-pdf's pdf function
      // Type cast needed due to ReactElement generic type mismatch with @react-pdf/renderer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(document as any).toBlob();

      // Create URL for the blob
      const url = URL.createObjectURL(blob);

      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data:application/pdf;base64, prefix if present
          const base64Data = result.split(',')[1] || result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const result: PDFGenerationResult = {
        blob,
        url,
        size: blob.size,
        base64,
      };

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate PDF');
      setError(error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generatePDF,
    isGenerating,
    error,
    clearError,
  };
}

export default usePDFGenerator;
