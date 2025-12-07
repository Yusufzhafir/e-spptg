import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Eye, Edit, Archive } from 'lucide-react';
import { Submission } from '../types';
import { StatusBadge } from './StatusBadge';

interface SubmissionsTableProps {
  submissions: Submission[];
  onViewDetail: (submission: Submission) => void;
  onEdit: (submission: Submission) => void;
}

export function SubmissionsTable({ submissions, onViewDetail, onEdit }: SubmissionsTableProps) {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 mb-4">Tidak ada pengajuan pada kriteria ini.</p>
        <Button variant="outline">Bersihkan filter</Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Pemilik</TableHead>
            <TableHead>Desa/Kecamatan</TableHead>
            <TableHead>Luas (m²)</TableHead>
            <TableHead>Tgl Pengajuan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Verifikator</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell>{submission.id}</TableCell>
              <TableCell>
                <div>
                  <p>{submission.namaPemilik}</p>
                  <p className="text-xs text-gray-500">{submission.nik}</p>
                </div>
              </TableCell>
              <TableCell>
                {submission.villageId.toString()}, {submission.kecamatan}
              </TableCell>
              <TableCell>{submission.luas.toLocaleString()}</TableCell>
              <TableCell>{submission.tanggalPengajuan.toLocaleDateString()}</TableCell>
              <TableCell>
                <StatusBadge status={submission.status} />
              </TableCell>
              <TableCell className="text-sm">{submission.verifikator || '-'}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetail(submission)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(submission)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
