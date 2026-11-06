import { useState } from 'react';
import { Check, Infinity as InfinityIcon, Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import OpsButton from '@/components/ops/OpsButton';
import { SEATS, USAGE, featureIcon, formatDate, formatPrice, limitText, seatLabel } from './billingUi';

const MOST_POPULAR = 'pro';
const ENTITLED = ['active', 'trialing', 'past_due'];

const SECTION = 'border-t border-border px-5 py-4';
const CHIP = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ops-accent)_14%,transparent)] text-[color:var(--ops-accent-ink)]';

function Label({ children }) {
  return <p className="mb-2.5 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

/** What the button on a plan does for this subscription: its text, whether it can be pressed, and why not. */
export function planAction(plan, subscription, plans, interval) {
  const entitled = ENTITLED.includes(subscription.status);
  const currentRank = entitled ? plans.find((p) => p.key === subscription.plan)?.rank ?? 0 : 0;
  if (entitled && subscription.plan === plan.key) return { kind: 'current', label: 'Current plan', disabled: true };
  if (!plan.intervals.includes(interval)) return { kind: 'none', label: 'Not available yet', disabled: true };
  if (!entitled) return { kind: 'subscribe', label: `Subscribe to ${plan.name}`, disabled: false };
  if (subscription.cancel_at_period_end) {
    return { kind: 'blocked', label: `Choose ${plan.name}`, disabled: true, hint: 'Resume your subscription before changing plan.' };
  }
  if (subscription.pending_change?.plan === plan.key) {
    return { kind: 'scheduled', label: `Starts ${formatDate(subscription.pending_change.effective_at)}`, disabled: true };
  }
  return plan.rank > currentRank
    ? { kind: 'upgrade', label: `Upgrade to ${plan.name}`, disabled: false }
    : { kind: 'downgrade', label: `Downgrade to ${plan.name}`, disabled: false };
}

function PlanCard({ plan, plans, subscription, interval, currency, busy, selected, onSelect, onChoose }) {
  const action = planAction(plan, subscription, plans, interval);
  const current = action.kind === 'current';
  const popular = plan.key === MOST_POPULAR;
  return (
    <article aria-label={`${plan.name} plan`} tabIndex={0} aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(plan.key)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(plan.key); } }}
      className={cn(
      'ops-card relative flex cursor-pointer flex-col overflow-visible rounded-[1.25rem] xl:row-span-6 xl:grid xl:grid-rows-subgrid xl:gap-y-0 transition-[transform,box-shadow] duration-300 motion-reduce:transition-none',
      'hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_rgba(248,114,23,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ops-accent)]',
      popular && 'bg-[radial-gradient(120%_40%_at_50%_0%,color-mix(in_srgb,var(--ops-accent)_14%,transparent),transparent_70%)]',
      current ? 'ring-2 ring-[var(--ops-good)]' : selected && 'ring-2 ring-[var(--ops-accent)]',
      selected && '-translate-y-1 shadow-[0_24px_48px_-28px_rgba(248,114,23,0.55)]',
    )}>
      {current ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--ops-good)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white dark:text-[#0b1a10]">
          <Check className="h-3 w-3" aria-hidden="true" /> Your current plan
        </span>
      ) : popular && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--ops-accent)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
          <Zap className="h-3 w-3" aria-hidden="true" /> Most popular
        </span>
      )}

      <div className="px-5 pb-4 pt-7">
        <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        <p className="mt-4 flex items-baseline gap-1">
          {interval === 'month' ? (
            <>
              <span className="ops-num text-[2.5rem] font-semibold leading-none tracking-tight">{formatPrice(plan.monthly_amount_usd, currency)}</span>
              <span className="text-base text-muted-foreground">/mo</span>
            </>
          ) : <span className="text-lg font-semibold">Billed annually</span>}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {interval === 'month' ? 'billed monthly' : 'the annual price is shown at checkout'}
          {currency === 'inr' && ` · about ${formatPrice(plan.monthly_amount_usd)} USD, charged in USD`}
        </p>
      </div>

      <div className={SECTION}>
        <Label>Usage allowance</Label>
        <ul className="space-y-2">
          {USAGE.map(({ key, icon: Icon, label }) => (
            <li key={key} className="flex items-center gap-3 text-sm">
              <span className={CHIP}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
              <span><span className="ops-num font-semibold">{limitText(plan.limits[key])}</span> {label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={SECTION}>
        <Label>Included seats</Label>
        <ul className="space-y-2">
          {SEATS.map(({ key, icon: Icon, label }) => (
            <li key={key} className="flex items-center gap-3 text-sm">
              <span className={CHIP}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
              <span className="flex-1"><span className="ops-num font-semibold">{limitText(plan.limits[key])}</span> {seatLabel(label, plan.limits[key])}</span>
              <Check className="h-4 w-4 shrink-0 text-[color:var(--ops-accent-ink)]" aria-label="Included" />
            </li>
          ))}
        </ul>
      </div>

      <div className={SECTION}>
        <Label>Features &amp; support</Label>
        <ul className="space-y-2">
          {plan.features.map((feature) => {
            const Icon = featureIcon(feature);
            return (
              <li key={feature} className="flex items-center gap-3 text-sm">
                <span className={CHIP}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                {feature}
              </li>
            );
          })}
        </ul>
      </div>

      <div className={cn(SECTION, 'flex-1 xl:flex-none')}>
        <Label>{plan.addons.length ? 'Additional seats (optional)' : 'Additional seats'}</Label>
        {plan.addons.length ? (
          <ul className="space-y-2">
            {plan.addons.map((addon) => (
              <li key={addon.label} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1">{addon.label}</span>
                <span className="whitespace-nowrap"><span className="ops-num font-semibold text-[color:var(--ops-accent-ink)]">{formatPrice(addon.monthly_amount_usd, currency)}</span><span className="text-xs text-muted-foreground">/month</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-3 text-sm">
            <span className={CHIP}><InfinityIcon className="h-3.5 w-3.5" aria-hidden="true" /></span>
            Unlimited Manager and Sales Rep seats are included.
          </p>
        )}
      </div>

      <div className="mt-auto self-end px-5 pb-5 pt-2">
        <OpsButton variant={action.disabled ? 'outline' : 'primary'} className="h-10 w-full" disabled={action.disabled} busy={busy}
          title={action.hint} onClick={(e) => { e.stopPropagation(); onSelect(plan.key); onChoose(plan, action.kind); }}>
          {current && <Check className="h-4 w-4" aria-hidden="true" />} {action.label}
        </OpsButton>
      </div>
    </article>
  );
}

export default function PlanCards({ plans, subscription, interval, currency = 'usd', busyPlan, onChoose }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="grid gap-5 pt-3 md:grid-cols-2 xl:grid-cols-3 xl:grid-rows-[repeat(6,auto)] xl:gap-y-0">
      {plans.map((plan) => (
        <PlanCard key={plan.key} plan={plan} plans={plans} subscription={subscription} interval={interval} currency={currency}
          busy={busyPlan === plan.key} selected={selected === plan.key} onSelect={setSelected} onChoose={onChoose} />
      ))}
    </div>
  );
}
