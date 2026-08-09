'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

/** The page sizes offered by every table in the app. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;

/**
 * Paging state for a table paged in Postgres. Lives here rather than beside a
 * component so the page it belongs to, the table that renders it, and the pager
 * itself all speak the same shape without importing each other.
 */
export type ServerPagination = {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
  lastPage: number;
};

/**
 * Client-side paging for a list already held in memory.
 *
 * The current page is clamped while rendering rather than corrected by an
 * effect: filtering a list down while sitting on page 3, or switching from 10
 * rows per page to 100, would otherwise leave the reader staring at an empty
 * table until something else triggered a re-render.
 */
export function useTablePagination<T>(rows: T[], initialPageSize = DEFAULT_PAGE_SIZE) {
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);
  const [page, setPage] = useState(0);

  const total = rows.length;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);

  return {
    page: currentPage,
    setPage,
    pageSize,
    /** Changing the size restarts at page 1 — the old offset means nothing now. */
    setPageSize: (next: number) => {
      setPageSizeState(next);
      setPage(0);
    },
    lastPage,
    total,
    pageRows: rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    /** Call after any filter or search change so the reader is not left past the end. */
    resetPage: () => setPage(0),
  };
}

/**
 * The footer under a table: how many rows to show, which rows these are, and
 * the way to the next page.
 *
 * Shared so every table in the app offers the same choices and reads the same
 * way. Server-paged tables (the audit log) pass the same props from their own
 * state instead of using the hook above.
 */
export function TablePager({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  lastPage,
  /** What the rows are, for the count line: "… dari 24 pengajuan". */
  noun = 'data',
  isBusy = false,
}: {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
  lastPage: number;
  noun?: string;
  isBusy?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 text-sm text-gray-600 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
        <div className="flex items-center gap-2">
          <span className="shrink-0">Tampilkan</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-[74px]" aria-label="Jumlah data per halaman">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="shrink-0">data</span>
        </div>

        <span className="text-gray-500">
          {total === 0
            ? `Tidak ada ${noun}`
            : `Menampilkan ${page * pageSize + 1}–${Math.min(
                (page + 1) * pageSize,
                total
              )} dari ${total} ${noun}`}
          {isBusy && ' · memuat…'}
        </span>
      </div>

      {lastPage > 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
