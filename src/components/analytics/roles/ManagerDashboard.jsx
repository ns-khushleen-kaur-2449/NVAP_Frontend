import StatusBadge from '@/components/ops/StatusBadge';
import { DataTable, FunnelChart, ItemList, SERIES, STATUS, StackedHBarChart } from '../charts';
import { Grid, KpiRow, Section } from '../Section';
import { ActionLink, FullAnalysisLink, campaignRows, funnelTable, tableOf } from './common';

// Hot → warm → other is an order, so one hue stepping lighter rather than three unrelated hues.
const TEMPERATURE = [
  { key: 'hot', name: 'Hot', color: SERIES[1] },
  { key: 'warm', name: 'Warm', color: 'color-mix(in srgb, var(--viz-2) 50%, hsl(var(--card)))' },
  { key: 'other', name: 'Other', color: STATUS.muted },
];

/** Sales Manager dashboard: approvals and how the manager's own team is doing. */
export default function ManagerDashboard() {
  return (
    <div className="space-y-4">
      <Section id="actionItems" title="Needs your approval" info="Campaign strategies and conversions waiting for your approval, and team items far past their deadline."
        empty={{ title: 'Nothing waiting for you', body: 'Approvals and escalations from your team appear here.' }}>
        {(items) => <ItemList items={items.map((it) => ({ ...it, right: <ActionLink item={it} /> }))} />}
      </Section>

      <KpiRow />

      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="leaderboard" title="Team leaderboard" subtitle="Ranked by conversions, then meetings" info="Each rep’s results in the period.">
          {(rows) => (
            <DataTable numeric={[1, 3, 4]} columns={['Rep', 'Contacted', 'Avg response', 'Meetings', 'Conversions']}
              rows={rows.map((r, i) => [`${i + 1} · ${r.rep}`, r.contacted, r.avgResponse, r.meetings, r.conversions])} />
          )}
        </Section>
        <Section id="workload" title="Workload distribution" info="Active prospects assigned to each rep, by temperature."
          table={tableOf(['Rep', 'Hot', 'Warm', 'Other', 'Overdue follow-ups'], (r) => [r.rep, r.hot, r.warm, r.other, r.overdue], [1, 2, 3, 4])}>
          {(rows) => (
            <>
              <StackedHBarChart data={rows} category="rep" series={TEMPERATURE} xTitle="Active prospects (count)" yTitle="Rep" />
              <p className="mt-2 text-xs text-muted-foreground">
                Overdue follow-ups: {rows.filter((r) => r.overdue).map((r) => `${r.rep} ${r.overdue}`).join(', ') || 'none'}
              </p>
            </>
          )}
        </Section>
      </Grid>

      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="coaching" title="Coaching opportunities" info="Reps whose response time, conversion or missed leads stand out from the team."
          empty={{ title: 'No coaching flags', body: 'Every rep is within the team’s usual range.' }}>
          {(rows) => <ItemList items={rows.map((c) => ({ title: c.title, detail: c.detail, right: <StatusBadge label={c.badge[0]} tone={c.badge[1]} /> }))} />}
        </Section>
        <Section id="funnel" title="Team funnel" subtitle="Prospects at each stage" info="How many of your team’s prospects reached each stage in the period."
          action={<FullAnalysisLink />} table={funnelTable}>
          {(stages) => <FunnelChart stages={stages} />}
        </Section>
      </Grid>

      <Section id="campaigns" title="Campaign comparison" info="Your team’s campaigns and what each produced.">
        {(rows) => <DataTable numeric={[3, 4, 5]} columns={['Campaign', 'Channels', 'Status', 'Contacted', 'Meetings', 'Conversions']} rows={campaignRows(rows)} minWidth={560} />}
      </Section>
    </div>
  );
}
