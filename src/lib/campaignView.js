// What the campaign detail page says about a campaign's state. Every fact comes from
// GET /api/campaigns/{id} (status, display_label, last_transition, warnings, in_flight_calls).

import { plural } from '@/lib/ops';

/** "11:20" in `zone`. */
export function clockIn(iso, zone) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/**
 * The status banner, or null when there is nothing to say:
 * { tone, text, kind } where kind picks the banner's buttons
 * (credits | missed | waiting | user_pause | system_pause | cancelling | warnings | failed).
 */
export function campaignBanner(campaign, zone) {
  if (!campaign) return null;
  const t = campaign.last_transition;
  const reason = t?.reason_text;
  switch (campaign.status) {
    case 'paused':
      if (campaign.paused_by_kind === 'user') {
        const who = t?.actor?.name || campaign.paused_by_user?.name || 'a team member';
        return { kind: 'user_pause', tone: 'warn',
          text: `Paused by ${who} at ${clockIn(campaign.paused_at || t?.created_at, zone)}${reason ? ` — “${reason}”` : ''}` };
      }
      return { kind: campaign.pause_reason_code === 'vapi_credits' ? 'credits' : 'system_pause', tone: 'bad',
        text: `Auto-paused: ${reason || campaign.display_label}` };
    case 'missed':
      return { kind: 'missed', tone: 'bad', text: `Missed scheduled start${reason ? ` (${reason})` : ''}` };
    case 'cancelling':
      return { kind: 'cancelling', tone: 'warn',
        text: `Cancelling — waiting for ${plural(campaign.in_flight_calls || 0, 'call')} to finish` };
    case 'failed':
      return { kind: 'failed', tone: 'bad', text: `Failed${reason ? `: ${reason}` : ''}` };
    default:
      break;
  }
  if (campaign.waiting) return { kind: 'waiting', tone: 'info', text: campaign.display_label };
  if (campaign.warnings?.length) return { kind: 'warnings', tone: 'info', text: campaign.warnings.join(' ') };
  return null;
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Whether a wall-clock date ("2026-10-23") and time ("14:30") in the campaign's zone fall inside
 * its calling window ({days, start_time, end_time}); no window means any time.
 */
export function insideWindow(window, date, time) {
  if (!window) return true;
  if (!date || !time) return false;
  const [y, m, d] = date.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return window.days.includes(day) && time >= window.start_time && time < window.end_time;
}
