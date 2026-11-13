import { ArrowRightLeft, CheckCircle2, ClipboardList, Clock3, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/ops/States';
import { formatDateTime, relativeTime } from '@/lib/ops';
import { readable } from './conversionUi';

// One look per timeline item type, from the backend's timeline builder.
function look(item) {
  switch (item.type) {
    case 'stage_change':
    case 'prospect_stage': return { icon: ArrowRightLeft, tone: 'good' };
    case 'evidence_candidate': return { icon: Sparkles, tone: 'info' };
    case 'evidence_verification': return { icon: ShieldCheck, tone: item.detail.action === 'VERIFY' ? 'good' : 'warn' };
    case 'review': return item.detail.action === 'REJECTED' ? { icon: XCircle, tone: 'bad' } : { icon: CheckCircle2, tone: 'good' };
    case 'decision': return { icon: ClipboardList, tone: 'warn' };
    default: return { icon: Clock3, tone: 'neutral' };
  }
}

function Summary({ item }) {
  const { detail } = item;
  if (item.type === 'decision') return <>{readable(detail.current_stage)} → {readable(detail.target_stage)} · {readable(detail.decision_status)}</>;
  if (item.type === 'evidence_candidate') return <>{readable(detail.criterion_code)} · {detail.verification_status?.toLowerCase()} · {detail.confidence}% confidence</>;
  if (item.type === 'stage_change' || item.type === 'prospect_stage') return <>{readable(detail.from_stage)} → {readable(detail.to_stage)}</>;
  if (item.type === 'evidence_verification') return <>{readable(detail.criterion_code)}</>;
  return null;
}

/** Chronological activity with a connector line, a type icon, status tone and timestamp. */
export default function ConversionTimeline({ items }) {
  if (!items?.length) return <EmptyState title="No conversion activity yet." body="Decisions, evidence and stage changes will appear here as they happen." />;
  return (
    <ol>
      {items.map((item, index) => {
        const { icon: Icon, tone } = look(item);
        const last = index === items.length - 1;
        return (
          <li key={`${item.type}-${item.id}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute left-4 top-9 bottom-0 w-px bg-border" />}
            <span className={`ops-tone ops-tone-${tone} relative z-[1] mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-semibold">{item.title}</p>
                <time dateTime={item.occurred_at} title={formatDateTime(item.occurred_at)} className="text-xs text-muted-foreground">
                  {relativeTime(item.occurred_at)}
                </time>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground"><Summary item={item} /></p>
              {item.detail.reason && <p className="mt-1 text-sm text-muted-foreground">{item.detail.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
