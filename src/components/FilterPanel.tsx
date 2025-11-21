import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Calendar, Download, FileUp, PlusCircle } from 'lucide-react';
import { StatusSPPTG } from '../types';

interface FilterPanelProps {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onNewSubmission: () => void;
}

export function FilterPanel({ statusFilter, onStatusFilterChange, onNewSubmission }: FilterPanelProps) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
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
            <Input type="date" className="w-[150px]" placeholder="Dari tanggal" />
            <span className="text-gray-400">-</span>
            <Input type="date" className="w-[150px]" placeholder="Sampai tanggal" />
          </div>

          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kecamatan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sukasari">Sukasari</SelectItem>
              <SelectItem value="lemahwungkuk">Lemahwungkuk</SelectItem>
              <SelectItem value="harjamukti">Harjamukti</SelectItem>
              <SelectItem value="kejaksan">Kejaksan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <FileUp className="w-4 h-4 mr-2" />
            Impor GeoJSON
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Ekspor CSV
          </Button>
          <Button onClick={onNewSubmission} size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            Ajukan Plot Lahan
          </Button>
        </div>
      </div>
    </div>
  );
}
