import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Download, Loader2, Search } from 'lucide-react';

interface FilterPanelProps {
  appliedSearch: string;
  onSearchSubmit: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  desaFilter: string;
  onDesaFilterChange: (value: string) => void;
  desaOptions: Array<{ id: number; namaDesa: string }>;
  isRefreshing: boolean;
}

export function FilterPanel({
  appliedSearch,
  onSearchSubmit,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  desaFilter,
  onDesaFilterChange,
  desaOptions,
  isRefreshing,
}: FilterPanelProps) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <form
            className="flex w-full sm:w-[320px] items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const value = formData.get('search');
              onSearchSubmit(typeof value === 'string' ? value : '');
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                name="search"
                type="text"
                placeholder="Cari nama pemilik, NIK, atau desa…"
                defaultValue={appliedSearch}
                className="pl-10"
              />
            </div>
            <Button type="submit" size="icon" variant="outline" aria-label="Terapkan pencarian">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="SPPTG terdaftar">SPPTG terdaftar</SelectItem>
              <SelectItem value="SPPTG terdata">SPPTG terdata</SelectItem>
              <SelectItem value="SPPTG ditolak">SPPTG ditolak</SelectItem>
              <SelectItem value="SPPTG ditinjau ulang">SPPTG ditinjau ulang</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-[150px]"
              placeholder="Dari tanggal"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <Input
              type="date"
              className="w-[150px]"
              placeholder="Sampai tanggal"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>

          <Select
            value={desaFilter || 'all'}
            onValueChange={(value) => onDesaFilterChange(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Desa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Desa</SelectItem>
              {desaOptions.map((desa) => (
                <SelectItem key={desa.id} value={String(desa.id)}>
                  {desa.namaDesa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Memperbarui hasil...</span>
            </div>
          ) : null}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Ekspor CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
