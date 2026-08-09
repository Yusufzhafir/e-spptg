'use client';

import { TableHead } from './ui/table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

/**
 * Clickable, sortable table header cell.
 *
 * Sorting itself happens in Postgres — every table that uses this holds one
 * page, so ordering the rows in the browser would order the wrong ones. See
 * `useTableUrlState` for the state behind `activeKey`/`dir`/`onSort`.
 */
export function SortableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-gray-900"
      >
        {label}
        {activeKey === sortKey ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>
    </TableHead>
  );
}
