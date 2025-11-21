import { Card, CardContent } from './ui/card';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
  bgColorClass: string;
}

export function KPICard({ title, value, icon: Icon, colorClass, bgColorClass }: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-600">{title}</p>
            <p className={`text-3xl ${colorClass}`}>{value}</p>
          </div>
          <div className={`${bgColorClass} p-3 rounded-lg`}>
            <Icon className={`w-6 h-6 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
