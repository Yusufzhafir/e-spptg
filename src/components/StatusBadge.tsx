import { Badge } from './ui/badge';
import { Check, Database, X, RefreshCw } from 'lucide-react';
import { StatusSPPTG } from '../types';

interface StatusBadgeProps {
  status: StatusSPPTG;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    'SPPTG terdaftar': {
      variant: 'default' as const,
      className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
      icon: Check,
    },
    'SPPTG terdata': {
      variant: 'secondary' as const,
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
      icon: Database,
    },
    'SPPTG ditolak': {
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200',
      icon: X,
    },
    'SPPTG ditinjau ulang': {
      variant: 'outline' as const,
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200',
      icon: RefreshCw,
    },
  } as const

  const { className, icon: Icon } = config[status as Exclude<StatusSPPTG,"Terbit SPPTG">];

  return (
    <Badge className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
}
