import { COMPLETENESS_DOTS, COMPLETENESS_HELP, COMPLETENESS_LABELS, describeCap } from '@/lib/leadScoreLabels';

/**
 * Data Completeness: how much of the scoring information was available (High / Medium /
 * Low), or "Not recorded" for a score calculated before it was recorded.  It is not a
 * prediction of conversion.  `capReason` explains a level shown lower than recorded.
 */
export default function DataCompleteness({ recorded, level, capReason, suffix = '' }) {
  const known = recorded && COMPLETENESS_LABELS[level];
  const cap = describeCap(capReason);
  return (
    <div className="text-xs" data-testid="data-completeness" title={COMPLETENESS_HELP}>
      <span className="text-muted-foreground">Data Completeness{suffix}: </span>
      {known ? (
        <span className="font-medium">
          <span aria-hidden="true" className="mr-1 tracking-tighter">{COMPLETENESS_DOTS[level]}</span>
          {COMPLETENESS_LABELS[level]}
        </span>
      ) : (
        <span className="font-medium">Not recorded</span>
      )}
      {known && cap && <span className="block text-muted-foreground">({cap})</span>}
    </div>
  );
}
