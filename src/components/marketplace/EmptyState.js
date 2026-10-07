import { Building2 } from 'lucide-react';

export default function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-2))]">
        <Building2 className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
