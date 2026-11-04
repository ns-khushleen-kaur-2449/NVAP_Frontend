import { CheckCircle2, CircleHelp, Clock3, FileCheck2, Sparkles } from 'lucide-react';

// Values come straight from the backend summary; nothing is computed or hardcoded here.
const CARDS = [
  { key: 'awaiting_approvals', label: 'Pending approvals', detail: 'Proposals waiting for approval', icon: Clock3, tone: 'warn' },
  { key: 'needs_review', label: 'Needs review', detail: 'Evaluations a person must look at', icon: CircleHelp, tone: 'info' },
  { key: 'evidence_to_verify', label: 'Evidence review', detail: 'Candidates awaiting verification', icon: Sparkles, tone: 'info' },
  { key: 'qualified_prospects', label: 'Qualified prospects', detail: 'At the qualified stage', icon: CheckCircle2, tone: 'good' },
  { key: 'converted_prospects', label: 'Converted prospects', detail: 'Approved transitions', icon: FileCheck2, tone: 'accent' },
];

export default function KpiCards({ summary }) {
  return (
    <section aria-label="Conversion summary" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5">
      {CARDS.map(({ key, label, detail, icon: Icon, tone }) => (
        <div key={key} className="ops-card flex h-full min-w-0 items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
            <p className="ops-num mt-2 text-[2rem] font-semibold leading-none tracking-tight">{summary?.[key] ?? '—'}</p>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </div>
          <span className={`ops-tone ops-tone-${tone} inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg`}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        </div>
      ))}
    </section>
  );
}
