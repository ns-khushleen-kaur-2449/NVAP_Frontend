import { Info, X } from 'lucide-react';
import { republishMessage } from '@/lib/catalogFields';

/** What the last catalog change did: notes about the change itself, then what it means for the agents. */
export default function ChangeNotice({ notes = [], agents, onDismiss }) {
  const lines = [...notes.filter(Boolean), republishMessage(agents)].filter(Boolean);
  if (!lines.length) return null;
  return (
    <div role="status" aria-label="Catalog change"
      className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        {lines.map((line) => <p key={line} dir="auto">{line}</p>)}
      </div>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
