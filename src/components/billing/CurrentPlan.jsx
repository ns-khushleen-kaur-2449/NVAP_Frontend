import { CreditCard, ExternalLink, RotateCcw, XCircle } from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { SEATS, STATUS, USAGE, formatDate, limitText, seatLabel } from './billingUi';

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{children}</dd>
    </div>
  );
}

/** The tenant's plan today: what it is, its state, when it renews or ends, and the actions that manage it. */
export default function CurrentPlan({ subscription, busy, onPortal, onCancel, onResume }) {
  const status = STATUS[subscription.status] || { label: subscription.status, tone: 'neutral' };
  const paid = subscription.plan !== 'free';
  const details = subscription.plan_details;
  const ends = subscription.cancel_at_period_end;
  const interval = subscription.interval === 'year' ? 'Annual' : subscription.interval === 'month' ? 'Monthly' : null;

  return (
    <section aria-label="Current plan" className="ops-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current plan</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{subscription.plan_name}</h2>
            <StatusBadge label={status.label} tone={status.tone} />
            {ends && <StatusBadge label="Cancels at period end" tone="warn" />}
          </div>
          {!paid && <p className="mt-2 max-w-md text-sm text-muted-foreground">Your organisation is on the Free plan. Choose a plan below to unlock more calls, minutes and seats.</p>}
        </div>

        {paid && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            <OpsButton onClick={onPortal} busy={busy === 'portal'}><CreditCard className="h-4 w-4" aria-hidden="true" /> Update payment method</OpsButton>
            <OpsButton onClick={onPortal} busy={busy === 'portal'}><ExternalLink className="h-4 w-4" aria-hidden="true" /> Manage subscription</OpsButton>
            {ends
              ? <OpsButton variant="primary" onClick={onResume} busy={busy === 'resume'}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Resume subscription</OpsButton>
              : subscription.status !== 'canceled' && <OpsButton variant="quiet" onClick={onCancel} className="text-[color:var(--ops-bad)]"><XCircle className="h-4 w-4" aria-hidden="true" /> Cancel subscription</OpsButton>}
          </div>
        )}
        {!paid && subscription.has_billing_account && (
          <OpsButton onClick={onPortal} busy={busy === 'portal'}><ExternalLink className="h-4 w-4" aria-hidden="true" /> View billing history</OpsButton>
        )}
      </div>

      {paid && (
        <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Billing">{interval || '—'}</Fact>
          <Fact label="Current period">{formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}</Fact>
          <Fact label={ends ? 'Plan ends' : 'Next renewal'}>{formatDate(subscription.current_period_end)}</Fact>
          <Fact label="Seats">
            {details ? `${limitText(details.limits.manager_seats)} ${seatLabel(SEATS[0].label, details.limits.manager_seats)}, ${limitText(details.limits.rep_seats)} ${seatLabel(SEATS[1].label, details.limits.rep_seats)}` : '—'}
          </Fact>
        </dl>
      )}

      {details && (
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          {USAGE.map(({ key, label }) => <li key={key}><span className="ops-num font-semibold text-foreground">{limitText(details.limits[key])}</span> {label}</li>)}
          {details.features.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
      )}

      {subscription.pending_change && (
        <p className="ops-tone ops-tone-info mt-4 rounded-[10px] px-3 py-2 text-sm">
          Your plan changes to <strong>{subscription.pending_change.plan_name}</strong> on {formatDate(subscription.pending_change.effective_at)}.
          Until then you keep all {subscription.plan_name} features.
        </p>
      )}
      {ends && (
        <p className="ops-tone ops-tone-warn mt-4 rounded-[10px] px-3 py-2 text-sm">
          Your subscription will not renew. {subscription.plan_name} stays active until {formatDate(subscription.current_period_end)}, then your organisation moves to Free.
        </p>
      )}
    </section>
  );
}
