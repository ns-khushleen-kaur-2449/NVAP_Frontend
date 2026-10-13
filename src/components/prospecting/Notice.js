import { AlertTriangle, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';

/** A small information or warning card used across the prospecting screens. */
export default function Notice({ tone = 'info', title, children }) {
  const amber = tone === 'warning';
  const Icon = amber ? AlertTriangle : Info;
  return (
    <Card className={`card-base p-3 flex items-start gap-2 ${amber ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${amber ? 'text-amber-600' : 'text-muted-foreground'}`} />
      <div className="min-w-0 text-xs space-y-1">
        {title && <p className={`font-semibold ${amber ? 'text-amber-700' : ''}`}>{title}</p>}
        {children}
      </div>
    </Card>
  );
}
