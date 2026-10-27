import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value) {
  if (!value) return 'N/A';
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)} L`;
  return value.toLocaleString('en-IN');
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  } catch {
    return '';
  }
}

export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getScoreColor(score) {
  if (score >= 70) return 'hsl(173, 80%, 36%)';
  if (score >= 40) return 'hsl(38, 55%, 62%)';
  return 'hsl(0, 72%, 52%)';
}

export function getScoreLabel(score) {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

// Prospect stages (backend ProspectStatus, lowercase as the Leads API returns them).
export const STAGE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'disqualified', label: 'Disqualified' },
  { value: 'do_not_contact', label: 'Do Not Contact' },
];

// Old lead stages read as prospect stages.  site_visit and negotiation are not mapped
// (candidate stages awaiting business sign-off) and show as they are.
const LEGACY_STAGES = { closed_won: 'converted', closed_lost: 'disqualified' };
export const normalizeStage = (stage) => {
  const value = (stage || '').toLowerCase();
  return LEGACY_STAGES[value] || value;
};

export const STAGE_COLORS = {
  new: 'bg-[hsla(199,70%,45%,0.18)] text-[hsl(199,70%,65%)] border border-[hsla(199,70%,45%,0.25)]',
  contacted: 'bg-[hsla(215,60%,50%,0.18)] text-[hsl(215,60%,70%)] border border-[hsla(215,60%,50%,0.25)]',
  engaged: 'bg-[hsla(250,60%,55%,0.18)] text-[hsl(250,60%,72%)] border border-[hsla(250,60%,55%,0.25)]',
  meeting: 'bg-[hsla(25,85%,55%,0.18)] text-[hsl(25,85%,65%)] border border-[hsla(25,85%,55%,0.25)]',
  qualified: 'bg-[hsla(173,80%,36%,0.18)] text-[hsl(173,80%,55%)] border border-[hsla(173,80%,36%,0.25)]',
  converted: 'bg-[hsla(158,64%,42%,0.18)] text-[hsl(158,64%,55%)] border border-[hsla(158,64%,42%,0.25)]',
  disqualified: 'bg-[hsla(0,72%,52%,0.16)] text-[hsl(0,72%,70%)] border border-[hsla(0,72%,52%,0.22)]',
  do_not_contact: 'bg-[hsla(222,22%,40%,0.3)] text-[hsl(215,20%,70%)] border border-[hsla(222,22%,40%,0.35)]',
  site_visit: 'bg-[hsla(38,55%,62%,0.18)] text-[hsl(38,55%,72%)] border border-[hsla(38,55%,62%,0.25)]',
  negotiation: 'bg-[hsla(280,60%,50%,0.18)] text-[hsl(280,60%,70%)] border border-[hsla(280,60%,50%,0.25)]',
  closed_won: 'bg-[hsla(158,64%,42%,0.18)] text-[hsl(158,64%,55%)] border border-[hsla(158,64%,42%,0.25)]',
  closed_lost: 'bg-[hsla(0,72%,52%,0.16)] text-[hsl(0,72%,70%)] border border-[hsla(0,72%,52%,0.22)]',
};

export const PRIORITY_COLORS = {
  urgent: 'bg-[hsla(0,72%,52%,0.16)] text-[hsl(0,72%,70%)]',
  high: 'bg-[hsla(38,92%,50%,0.16)] text-[hsl(38,92%,65%)]',
  medium: 'bg-[hsla(199,70%,45%,0.16)] text-[hsl(199,70%,65%)]',
  low: 'bg-[hsla(222,22%,40%,0.3)] text-[hsl(215,20%,70%)]',
};
