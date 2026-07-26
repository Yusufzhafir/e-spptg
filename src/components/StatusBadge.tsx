import { Badge } from './ui/badge';
import { Check, Database, X, RefreshCw, Award } from 'lucide-react';
import { StatusSPPTG } from '../types';

interface StatusBadgeProps {
  status: StatusSPPTG;
}

const STATUS_CONFIG: Record<
  StatusSPPTG,
  { className: string; icon: typeof Check }
> = {
  'SPPTG terdaftar': {
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
    icon: Check,
  },
  'SPPTG terdata': {
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
    icon: Database,
  },
  'SPPTG ditolak': {
    className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200',
    icon: X,
  },
  'SPPTG ditinjau ulang': {
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200',
    icon: RefreshCw,
  },
  // Final state: the certificate has been issued.
  'Terbit SPPTG': {
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200',
    icon: Award,
  },
};

const FALLBACK = {
  className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200',
  icon: Database,
};

export function StatusBadge({ status }: StatusBadgeProps) {
  // Fall back rather than crash if an unmapped status ever reaches the UI.
  const { className, icon: Icon } = STATUS_CONFIG[status] ?? FALLBACK;

  return (
    <Badge className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
}
