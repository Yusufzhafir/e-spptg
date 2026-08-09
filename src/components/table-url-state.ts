'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_PAGE_SIZE, type ServerPagination } from './table-pagination';
import type { SortDir } from './table-sort';

/** Query-string key the free-text search lives under, on every table. */
const SEARCH_PARAM = 'q';

/** How long to wait after the last keystroke before asking the server. */
const SEARCH_DEBOUNCE_MS = 300;

export type TableUrlState<TSortKey extends string> = {
  /** Filter values read from the URL; `''` means "not set". */
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  /** What the search box shows — updates on every keystroke. */
  search: string;
  setSearch: (value: string) => void;
  /** What the server was actually asked for; lags `search` by the debounce. */
  appliedSearch: string;
  /** True when a search or filter is narrowing the list. */
  hasFilter: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  sortKey: TSortKey;
  sortDir: SortDir;
  toggleSort: (key: string) => void;
};

/**
 * Search, filters, paging and sort for a table paged in Postgres.
 *
 * Search and filters live in the URL so the view survives a refresh, a shared
 * link, and the walk back from a detail page; paging and sort stay in component
 * state, the same split the dashboard uses. Everything that changes *what* is
 * being listed sends the reader back to page 1 — keeping the old offset against
 * a narrower result set asks Postgres for rows that no longer exist.
 *
 * `filterKeys` must be a stable reference (a module-level constant); it is a
 * dependency of the memo that reads them.
 */
export function useTableUrlState<TSortKey extends string>(
  filterKeys: readonly string[],
  initialSort: { key: TSortKey; dir: SortDir }
): TableUrlState<TSortKey> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<TSortKey>(initialSort.key);
  const [sortDir, setSortDir] = useState<SortDir>(initialSort.dir);

  const filters = useMemo(() => {
    const values: Record<string, string> = {};
    for (const key of filterKeys) values[key] = searchParams.get(key) ?? '';
    return values;
  }, [filterKeys, searchParams]);

  const appliedSearch = searchParams.get(SEARCH_PARAM) ?? '';

  /**
   * `replace`, not `push`: a debounced search would otherwise leave one history
   * entry per keystroke, and the back button would walk the reader backwards
   * through their own typing.
   */
  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      setPage(0);
    },
    [pathname, router, searchParams]
  );

  const [search, setSearch] = useState(appliedSearch);

  // The box reacts to every keystroke; the server hears about it once the
  // typing stops. Comparing against the URL first keeps this from re-firing
  // when some *other* param changes and hands us a new `setParam`.
  useEffect(() => {
    if (search.trim() === appliedSearch) return;
    const timer = setTimeout(() => setParam(SEARCH_PARAM, search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, appliedSearch, setParam]);

  const toggleSort = useCallback(
    (key: string) => {
      setSortDir((current) => (key === sortKey && current === 'asc' ? 'desc' : 'asc'));
      setSortKey(key as TSortKey);
      setPage(0);
    },
    [sortKey]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(0);
  }, []);

  return {
    filters,
    setFilter: setParam,
    search,
    setSearch,
    appliedSearch,
    hasFilter: Boolean(appliedSearch) || Object.values(filters).some(Boolean),
    page,
    setPage,
    pageSize,
    setPageSize,
    sortKey,
    sortDir,
    toggleSort,
  };
}

/**
 * The pager props for a server-paged table, given the row count the server
 * reported.
 */
export function useServerPagination<TSortKey extends string>(
  state: TableUrlState<TSortKey>,
  total: number
): ServerPagination {
  const { page, setPage, pageSize, setPageSize } = state;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  // Deleting the last row of the last page strands the reader past the end:
  // the next fetch comes back empty with no visible way forward. Every other
  // way the result set narrows already resets to page 1 itself, so this only
  // fires when rows disappear from under someone.
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage, setPage]);

  return { page: Math.min(page, lastPage), setPage, pageSize, setPageSize, total, lastPage };
}
