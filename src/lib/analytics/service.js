/**
 * The one place Dashboard and Reports data comes from. Components call fetchSection(key, …) and never know
 * whether the answer came from the backend or from the mock; switching a section to the real API is done in
 * endpoints.js only.
 */
import { http } from '@/lib/api';
import { ENDPOINTS } from './endpoints';
import { MOCK, scopeOf } from './mockData';

/** The data behind a section is not recorded yet (as opposed to a failed request). */
export class DataNotAvailable extends Error {
  constructor(reason) { super(reason); this.name = 'DataNotAvailable'; }
}

const ISO = (d) => d.toISOString().slice(0, 10);
const PERIOD_DAYS = { today: 0, '7d': 6, '30d': 29, '90d': 89 };

/** Date range of a period preset (inclusive, local calendar days), or the custom from/to as chosen. */
export function dateRange(filters, now = new Date()) {
  if (filters.period === 'custom') return { from: filters.from || null, to: filters.to || null };
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - (PERIOD_DAYS[filters.period] ?? 6));
  return { from: ISO(from), to: ISO(to) };
}

/** Filters → query parameters. "All" choices are left out rather than sent as a value. */
export function toParams(filters = {}) {
  const { from, to } = dateRange(filters);
  const params = { from, to, campaign: filters.campaign, channel: filters.channel, rep: filters.rep, team: filters.team };
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== 'all'));
}

// Simulated network time for mock answers, so loading states show as they will live. Tests set it to 0.
let mockLatencyMs = 350;
export const setMockLatency = (ms) => { mockLatencyMs = ms; };
const copy = (v) => JSON.parse(JSON.stringify(v));

const delay = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
});

/**
 * GET one section. `role` is used only by the mock to pick the scope the backend would apply; a live request
 * sends the filters and nothing about the role.
 */
export async function fetchSection(key, { role, filters, signal } = {}) {
  const endpoint = ENDPOINTS[key];
  if (!endpoint) throw new Error(`Unknown analytics section: ${key}`);
  if (endpoint.source === 'unavailable') throw new DataNotAvailable(endpoint.reason);
  if (endpoint.source === 'live') {
    const { data } = await http.get(endpoint.path, { params: toParams(filters), signal });
    return data;
  }
  await delay(mockLatencyMs, signal);
  const data = MOCK[scopeOf(role)][key];
  return data === undefined ? null : copy(data);
}

const csvCell = (v) => {
  const s = Array.isArray(v) ? v[0] : v ?? '';
  return /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
};
const titleCase = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** One CSV block per section: a heading line, then the rows of that section as they would be exported. */
function sectionCsv(title, rows) {
  if (!Array.isArray(rows) || !rows.length) return `${title}\nNo data\n`;
  const cols = Object.keys(rows[0]).filter((c) => !['trend', 'bar', 'tone', 'href', 'primary'].includes(c));
  return [title, cols.map(titleCase).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

/**
 * CSV of the Reports page for these filters. Live: the backend's export endpoint (same filters). Until then the
 * file is built from the same section answers the page shows, so it matches what is on screen.
 */
export async function exportReportsCsv({ role, filters, sections }) {
  if (ENDPOINTS.export.source === 'live') {
    const { data } = await http.get(ENDPOINTS.export.path, { params: { ...toParams(filters), format: 'csv' }, responseType: 'blob' });
    return data;
  }
  const { from, to } = dateRange(filters);
  const blocks = [`SmartSDR report,${from || ''} to ${to || ''}`];
  for (const [key, title] of sections) {
    if (ENDPOINTS[key].source === 'unavailable') { blocks.push(`${title}\nData not available yet\n`); continue; }
    // eslint-disable-next-line no-await-in-loop
    blocks.push(sectionCsv(title, await fetchSection(key, { role, filters })));
  }
  return new Blob([blocks.join('\n')], { type: 'text/csv;charset=utf-8' });
}
