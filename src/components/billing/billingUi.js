import { AudioLines, CalendarSync, Headset, Mail, PhoneCall, UserCog, Users } from 'lucide-react';
import { DEFAULT_TIME_ZONE } from '@/lib/ops';

/** Window event the Billing page sends when the organisation's plan is known or changes; the sidebar listens. */
export const BILLING_CHANGED = 'smartsdr:billing-changed';

/** Sends the browser to a Stripe-hosted page (Checkout, Customer Portal, an invoice). A function so tests can replace it. */
export const redirectTo = (url) => window.location.assign(url);

// A subscription status from the backend -> what the visitor reads, and the tone that colours it.
export const STATUS = {
  none: { label: 'Free', tone: 'neutral' },
  active: { label: 'Active', tone: 'good' },
  trialing: { label: 'Trial', tone: 'info' },
  past_due: { label: 'Payment failed', tone: 'bad' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
  incomplete: { label: 'Awaiting payment', tone: 'warn' },
  incomplete_expired: { label: 'Expired', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'warn' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
};

export const INVOICE_STATUS = {
  paid: { label: 'Paid', tone: 'good' },
  open: { label: 'Open', tone: 'warn' },
  uncollectible: { label: 'Uncollectible', tone: 'bad' },
  void: { label: 'Void', tone: 'neutral' },
};

// The plan's allowances, in the order the pricing cards list them. `null` is unlimited.
export const USAGE = [
  { key: 'calls_per_month', icon: PhoneCall, label: 'AI-qualified calls/month' },
  { key: 'voice_minutes', icon: AudioLines, label: 'voice minutes' },
];
export const SEATS = [
  { key: 'manager_seats', icon: UserCog, label: 'Manager' },
  { key: 'rep_seats', icon: Users, label: 'Sales Rep' },
];

export function featureIcon(label) {
  if (/CRM|calendar/i.test(label)) return CalendarSync;
  if (/success manager/i.test(label)) return Headset;
  return Mail;
}

export function limitText(value) {
  return value == null ? 'Unlimited' : value.toLocaleString('en-US');
}

export function seatLabel(label, value) {
  return `${label} seat${value === 1 ? '' : 's'}`;
}

export function formatDate(iso, timeZone = DEFAULT_TIME_ZONE) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** An amount in a currency's smallest unit (Stripe's), e.g. 24900 usd -> "$249.00". */
export function formatMoney(minorUnits, currency = 'usd') {
  if (minorUnits == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency).toUpperCase() }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${String(currency).toUpperCase()}`;
  }
}

// Indicative display rate only: Stripe always charges in USD. Override with REACT_APP_USD_INR_RATE.
export const USD_TO_INR = Number(process.env.REACT_APP_USD_INR_RATE) || 88;

export function formatPrice(amount, currency = 'usd') {
  if (currency === 'inr') return `₹${Math.round(amount * USD_TO_INR).toLocaleString('en-IN')}`;
  return `$${amount.toLocaleString('en-US')}`;
}
