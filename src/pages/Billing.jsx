import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  cancelBillingSubscription, changeBillingPlan, createCheckoutSession, createPortalSession,
  getBillingPlans, getBillingSubscription, resumeBillingSubscription, syncBillingSubscription,
} from '@/lib/api';
import { errorMessage } from '@/hooks/useApiAction';
import ConfirmDialog from '@/components/ops/ConfirmDialog';
import OpsButton from '@/components/ops/OpsButton';
import { ErrorState, SkeletonRows } from '@/components/ops/States';
import CurrentPlan from '@/components/billing/CurrentPlan';
import CurrencyToggle from '@/components/billing/CurrencyToggle';
import PlanCards from '@/components/billing/PlanCards';
import { BILLING_CHANGED, formatDate, redirectTo } from '@/components/billing/billingUi';

// After Checkout the plan is switched on by Stripe's webhook, not by this page. Ask the backend until it has.
const CONFIRM_EVERY_MS = 2500;
const CONFIRM_ATTEMPTS = 12;

export default function Billing() {
  const [params, setParams] = useSearchParams();
  const checkout = params.get('checkout');
  // Back from Stripe's upgrade page: the plan that was paid for.
  const upgradeTo = params.get('upgrade');
  const [plans, setPlans] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [billingInterval, setBillingInterval] = useState('month');
  const [currency, setCurrency] = useState('usd');
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const [planResponse, subscriptionResponse] = await Promise.all([getBillingPlans(), getBillingSubscription()]);
      setPlans(planResponse.data.plans);
      setConfigured(planResponse.data.billing_configured !== false);
      setSubscription(subscriptionResponse.data);
      setLoadError(null);
      // A webhook can be missed (e.g. `stripe listen` not running): re-read the plan from Stripe itself.
      if (subscriptionResponse.data.has_billing_account) {
        syncBillingSubscription().then(({ data }) => setSubscription(data)).catch(() => {});
      }
    } catch (error) {
      setLoadError(errorMessage(error, 'Billing could not be loaded.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tell the sidebar which plan the organisation is on now.
  const planKey = subscription?.plan;
  const planName = subscription?.plan_name;
  useEffect(() => {
    if (planKey) window.dispatchEvent(new CustomEvent(BILLING_CHANGED, { detail: { key: planKey, name: planName } }));
  }, [planKey, planName]);

  // Back from Stripe Checkout or Stripe's upgrade page.
  useEffect(() => {
    if (checkout === 'cancelled') {
      setNotice({ tone: 'info', text: 'Checkout was cancelled. You have not been charged.' });
      setParams({}, { replace: true });
      return undefined;
    }
    let done = null;
    if (checkout === 'success') done = (data) => data.plan !== 'free';
    else if (upgradeTo) done = (data) => data.plan === upgradeTo;
    if (!done) return undefined;
    let stopped = false;
    let timer;
    let attempts = 0;
    setNotice({ tone: 'info', text: 'Confirming your payment with Stripe…', pending: true });
    const poll = async () => {
      try {
        // Asks Stripe directly, so the plan shows even when the webhook has not arrived.
        const { data } = await syncBillingSubscription();
        if (stopped) return;
        setSubscription(data);
        if (done(data)) {
          setNotice({ tone: 'good', text: `Payment confirmed. Your ${data.plan_name} plan is now active.` });
          setParams({}, { replace: true });
          return;
        }
      } catch {
        // Try again below; a failed poll is not a failed payment.
      }
      attempts += 1;
      if (attempts >= CONFIRM_ATTEMPTS) {
        setNotice({ tone: 'warn', text: 'Your payment is still being confirmed. This usually takes a few seconds — refresh this page shortly. You have not been charged twice.' });
        setParams({}, { replace: true });
        return;
      }
      timer = setTimeout(poll, CONFIRM_EVERY_MS);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [checkout, upgradeTo, setParams]);

  const fail = (error, fallback) => toast.error(errorMessage(error, fallback));

  const startCheckout = async (plan) => {
    setBusy(plan.key);
    try {
      const { data } = await createCheckoutSession(plan.key, billingInterval);
      redirectTo(data.url);
    } catch (error) {
      fail(error, 'Checkout could not be started.');
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    try {
      const { data } = await createPortalSession();
      redirectTo(data.url);
    } catch (error) {
      fail(error, 'The billing portal could not be opened.');
      setBusy(null);
    }
  };

  const resume = async () => {
    setBusy('resume');
    try {
      const { data } = await resumeBillingSubscription();
      setSubscription(data);
      setNotice({ tone: 'good', text: `Your ${data.plan_name} subscription will renew as normal.` });
    } catch (error) {
      fail(error, 'The subscription could not be resumed.');
    } finally {
      setBusy(null);
    }
  };

  const choose = (plan, kind) => {
    if (kind === 'subscribe') startCheckout(plan);
    else if (kind === 'cancel') setConfirm({ kind: 'cancel' }); // moving to Free is cancelling at the period end
    else setConfirm({ kind, plan });
  };

  const applyChange = async () => {
    const { plan } = confirm;
    try {
      const { data } = await changeBillingPlan(plan.key, billingInterval);
      setSubscription(data.subscription);
      if (data.result === 'payment_required') {
        // Every upgrade is paid on Stripe's hosted page; it comes back to /billing?upgrade=<plan>.
        redirectTo(data.payment_url);
        return true;
      }
      if (data.result === 'scheduled') {
        setNotice({ tone: 'info', text: `You will move to ${plan.name} on ${formatDate(data.effective_at)}. Until then you keep all your current features.` });
      } else if (data.result === 'pending_payment') {
        setNotice({ tone: 'warn', text: `Your ${plan.name} upgrade starts as soon as Stripe has taken the payment.`, href: data.payment_url, linkLabel: 'Complete payment' });
      } else {
        setNotice({ tone: 'good', text: `You are now on ${plan.name}. Stripe charges only the prorated difference for this period.` });
      }
      return true;
    } catch (error) {
      fail(error, 'The plan could not be changed.');
      return false;
    }
  };

  const applyCancel = async () => {
    try {
      const { data } = await cancelBillingSubscription();
      setSubscription(data);
      setNotice({ tone: 'warn', text: `Your subscription is cancelled. ${data.plan_name} stays active until ${formatDate(data.current_period_end)}.` });
      return true;
    } catch (error) {
      fail(error, 'The subscription could not be cancelled.');
      return false;
    }
  };

  const hasYearly = Boolean(plans?.some((plan) => plan.intervals.includes('year')));
  const pastDue = subscription && ['past_due', 'unpaid'].includes(subscription.status);
  const target = confirm?.plan;

  let confirmProps = null;
  if (confirm?.kind === 'upgrade') {
    confirmProps = {
      title: `Upgrade to ${target.name}`, confirmLabel: 'Continue to payment', onConfirm: applyChange,
      description: `You will go to Stripe's secure payment page to review and pay the prorated difference for the rest of this billing period. You can change your card there. ${target.name} starts as soon as the payment succeeds.`,
    };
  } else if (confirm?.kind === 'downgrade') {
    confirmProps = {
      title: `Downgrade to ${target.name}`, confirmLabel: `Downgrade to ${target.name}`, onConfirm: applyChange,
      description: `You keep ${subscription.plan_name} until ${formatDate(subscription.current_period_end)}, then move to ${target.name} at your next billing date. Nothing is removed before then.`,
    };
  } else if (confirm?.kind === 'cancel') {
    confirmProps = {
      title: 'Cancel subscription', confirmLabel: 'Cancel subscription', danger: true, onConfirm: applyCancel,
      description: `${subscription.plan_name} stays active until ${formatDate(subscription.current_period_end)}. After that your organisation moves to the Free plan and you are not charged again.`,
    };
  }

  return <>
    <main className="ops mx-auto max-w-[1280px] space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Billing &amp; subscription</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Choose a plan for your organisation, change it at any time, and manage your payment details.</p>
      </header>

      {notice && (
        <div role="status" className={`ops-tone ops-tone-${notice.tone} flex flex-wrap items-center gap-3 rounded-[14px] p-4 text-sm`}>
          <p className="flex-1">{notice.text}</p>
          {notice.href && <OpsButton variant="primary" size="sm" onClick={() => redirectTo(notice.href)}>{notice.linkLabel}</OpsButton>}
          {!notice.pending && <OpsButton variant="quiet" size="sm" onClick={() => setNotice(null)}>Dismiss</OpsButton>}
        </div>
      )}
      {pastDue && (
        <div role="alert" className="ops-tone ops-tone-bad flex flex-wrap items-center gap-3 rounded-[14px] p-4 text-sm">
          <p className="flex-1"><strong>Your last payment failed.</strong> Update your payment method so your plan is not interrupted.</p>
          <OpsButton variant="primary" size="sm" onClick={openPortal} busy={busy === 'portal'}>Update payment method</OpsButton>
        </div>
      )}
      {!configured && (
        <div role="status" className="ops-tone ops-tone-warn rounded-[14px] p-4 text-sm">
          Billing is not set up on this server yet, so plans cannot be bought. Ask your platform administrator to add the Stripe settings.
        </div>
      )}

      {loadError && <ErrorState title="Billing could not be loaded." message={loadError} onRetry={load} />}
      {!loadError && !subscription && <div aria-busy="true"><SkeletonRows rows={1} label="Loading your plan" /></div>}

      {subscription && plans && <>
        {subscription.plan !== 'free' && (
          <CurrentPlan subscription={subscription} busy={busy} onPortal={openPortal} onResume={resume} onCancel={() => setConfirm({ kind: 'cancel' })} />
        )}

        <section aria-label="Available plans" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Available plans</h2>
            <div className="flex flex-wrap items-center gap-3">
              <CurrencyToggle value={currency} onChange={setCurrency} />
              {hasYearly && (
                <div role="group" aria-label="Billing interval" className="inline-flex rounded-lg border border-border p-0.5 text-sm">
                  {[['month', 'Monthly'], ['year', 'Annual']].map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={billingInterval === value} onClick={() => setBillingInterval(value)}
                      className={`rounded-md px-3 py-1 font-semibold transition-colors ${billingInterval === value ? 'bg-[var(--ops-accent)] text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <PlanCards plans={plans} subscription={subscription} interval={billingInterval} currency={currency} busyPlan={busy} onChoose={choose} />
        </section>
      </>}
    </main>
    {confirmProps && <ConfirmDialog open onOpenChange={(open) => { if (!open) setConfirm(null); }} {...confirmProps} />}
  </>;
}
