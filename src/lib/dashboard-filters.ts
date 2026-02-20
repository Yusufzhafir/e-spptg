const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_STATUSES = new Set([
  'all',
  'SPPTG terdaftar',
  'SPPTG terdata',
  'SPPTG ditolak',
  'SPPTG ditinjau ulang',
]);

type SearchParamsLike = Pick<URLSearchParams, 'get' | 'entries'>;

export type DashboardFilters = {
  search: string;
  status: string;
  desaId: string;
  kecamatan: string;
  dateFrom: string;
  dateTo: string;
};

export type DashboardFilterPatch = Partial<
  Pick<DashboardFilters, 'search' | 'status' | 'desaId' | 'dateFrom' | 'dateTo'>
>;

function normalizeDate(value: string | null): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return DATE_REGEX.test(trimmed) ? trimmed : '';
}

function normalizeStatus(value: string | null): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'all';
  return ALLOWED_STATUSES.has(trimmed) ? trimmed : 'all';
}

function normalizeDesaId(value: string | null): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (!/^\d+$/.test(trimmed)) return '';
  return Number(trimmed) > 0 ? trimmed : '';
}

function cloneParams(params: SearchParamsLike): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    next.append(key, value);
  }
  return next;
}

function applyQueryValue(params: URLSearchParams, key: string, value: string) {
  if (!value) {
    params.delete(key);
    return;
  }
  params.set(key, value);
}

export function parseDashboardFilters(params: SearchParamsLike): DashboardFilters {
  const search = (params.get('search') ?? '').trim();
  const status = normalizeStatus(params.get('status'));
  const desaId = normalizeDesaId(params.get('desaId'));
  const kecamatan = (params.get('kecamatan') ?? '').trim();
  let dateFrom = normalizeDate(params.get('dateFrom'));
  let dateTo = normalizeDate(params.get('dateTo'));

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const temp = dateFrom;
    dateFrom = dateTo;
    dateTo = temp;
  }

  return {
    search,
    status,
    desaId,
    kecamatan,
    dateFrom,
    dateTo,
  };
}

export function buildDashboardSearchParams(
  currentParams: SearchParamsLike,
  patch: DashboardFilterPatch
): URLSearchParams {
  const params = cloneParams(currentParams);

  if (patch.search !== undefined) {
    applyQueryValue(params, 'search', patch.search.trim());
  }

  if (patch.status !== undefined) {
    const normalizedStatus = patch.status.trim();
    applyQueryValue(params, 'status', normalizedStatus === 'all' ? '' : normalizedStatus);
  }

  if (patch.dateFrom !== undefined) {
    const normalized = normalizeDate(patch.dateFrom);
    applyQueryValue(params, 'dateFrom', normalized);
  }

  if (patch.dateTo !== undefined) {
    const normalized = normalizeDate(patch.dateTo);
    applyQueryValue(params, 'dateTo', normalized);
  }

  if (patch.desaId !== undefined) {
    const normalizedDesaId = normalizeDesaId(patch.desaId);
    applyQueryValue(params, 'desaId', normalizedDesaId);
    // Migrate away from deprecated area param once Desa filter is touched.
    params.delete('kecamatan');
  }

  const normalized = parseDashboardFilters(params);
  applyQueryValue(params, 'dateFrom', normalized.dateFrom);
  applyQueryValue(params, 'dateTo', normalized.dateTo);

  return params;
}
