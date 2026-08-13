'use client';

import { useState } from 'react';
import { Calendar, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { cn } from '@/lib/utils';
import type { PilihanTahun } from '@/lib/landing-stats';

/**
 * Searchable year picker for the per-desa report.
 *
 * A combobox rather than a native `<select>` so the list can be typed into: a
 * register that has run for a decade turns into a scroll otherwise, and typing
 * "20" is faster than hunting. Built from the same shadcn Popover + Command
 * primitives the rest of the app uses, so it inherits the app's keyboard
 * behaviour (arrow keys, Enter, Escape) instead of reinventing it.
 */

const SEMUA = 'semua';

export function PilihTahun({
  tahun,
  tahunTersedia,
  onPilih,
  jumlahBaris,
}: {
  tahun: PilihanTahun;
  tahunTersedia: number[];
  onPilih: (tahun: PilihanTahun) => void;
  /** Rows behind the current choice, shown as a hint under the trigger. */
  jumlahBaris?: number;
}) {
  const [terbuka, setTerbuka] = useState(false);

  const label = tahun === SEMUA ? 'Semua Tahun' : String(tahun);
  const opsi: { nilai: PilihanTahun; label: string; cari: string }[] = [
    { nilai: SEMUA, label: 'Semua Tahun', cari: 'semua tahun all' },
    ...tahunTersedia.map((item) => ({
      nilai: item as PilihanTahun,
      label: String(item),
      cari: String(item),
    })),
  ];

  return (
    <div>
      <label
        id="label-tahun-laporan"
        className="block text-xs font-medium text-gray-500"
      >
        Pilih Tahun Laporan
      </label>

      <Popover open={terbuka} onOpenChange={setTerbuka}>
        <PopoverTrigger asChild>
          {/* A disclosure button, not `role="combobox"`: the real combobox is
              the search input inside the popover, and claiming the role here
              would promise `aria-controls` for a listbox that does not exist
              until the popover opens. */}
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={terbuka}
            // Both ids: the label alone would announce "Pilih Tahun Laporan"
            // without ever saying which year is currently chosen.
            aria-labelledby="label-tahun-laporan nilai-tahun-laporan"
            className="mt-1.5 flex w-56 items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:border-gray-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-blue-600" />
              <span id="nilai-tahun-laporan" className="truncate">
                {label}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56 p-0">
          <Command>
            <CommandInput placeholder="Cari tahun…" className="h-9" />
            <CommandList>
              <CommandEmpty>Tahun tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {opsi.map((item) => (
                  <CommandItem
                    key={String(item.nilai)}
                    // cmdk filters on `value`, so the searchable text goes here
                    // and the visible label is rendered separately.
                    value={item.cari}
                    onSelect={() => {
                      onPilih(item.nilai);
                      setTerbuka(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        tahun === item.nilai ? 'opacity-100 text-blue-600' : 'opacity-0'
                      )}
                    />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {typeof jumlahBaris === 'number' && (
        <p className="mt-1.5 text-xs text-gray-500">
          {jumlahBaris} desa/kelurahan pada periode ini
        </p>
      )}
    </div>
  );
}
