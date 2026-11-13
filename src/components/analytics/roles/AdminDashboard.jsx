import { Link } from 'react-router-dom';
import StatusBadge from '@/components/ops/StatusBadge';
import { Switch } from '@/components/ui/switch';
import { ColumnChart, FunnelChart, HBarChart, ItemList, Meter, SERIES, STATUS } from '../charts';
import { Grid, KpiRow, Section } from '../Section';
import { FullAnalysisLink, funnelTable, tableOf } from './common';

const statusItems = (rows) => <ItemList items={rows.map((r) => ({ title: r.title, detail: r.detail, right: <StatusBadge label={r.badge[0]} tone={r.badge[1]} /> }))} />;
export const ManagePlanLink = () => (
  <Link to="/billing" className="text-xs font-semibold text-[color:var(--ops-accent-ink)] hover:underline">Manage plan →</Link>
);
// Expected answer of the usage endpoints once they exist: [{ label, used, limit }].
export const usageMeters = (rows) => <div className="space-y-4">{rows.map((r) => <Meter key={r.label} {...r} />)}</div>;

/** Tenant Admin dashboard: the whole organisation's results, AI, integrations and compliance. */
export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      <KpiRow />

      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="aiUsage" title="AI usage and cost" info="AI spend and the number of AI requests per day. Shown as two charts because they use different scales."
          table={tableOf(['Day', 'AI cost ($)', 'AI requests'], (r) => [r.day, r.cost, r.requests], [1, 2])}>
          {(rows) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <ColumnChart data={rows} x="day" prefix="$" height={180} series={[{ key: 'cost', name: 'AI cost', color: SERIES[1] }]} xTitle="Day of week" yTitle="AI cost ($)" />
              <ColumnChart data={rows} x="day" height={180} series={[{ key: 'requests', name: 'AI requests', color: SERIES[0] }]} xTitle="Day of week" yTitle="AI requests (count)" />
            </div>
          )}
        </Section>
        <Section id="funnel" title="Tenant funnel" subtitle="Prospects at each stage" info="How many of the organisation’s prospects reached each stage in the period."
          action={<FullAnalysisLink />} table={funnelTable}>
          {(stages) => <FunnelChart stages={stages} />}
        </Section>
      </Grid>

      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="integrationHealth" title="Integration health" info="Connection state of each connected service and its recent failures.">{statusItems}</Section>
        <Section id="featureAdoption" title="Feature adoption" info="Share of active users who used each AI feature in the period."
          table={tableOf(['Feature', 'Active users using it'], (r) => [r.feature, `${r.share}%`], [1])}>
          {(rows) => <HBarChart data={rows} category="feature" value="share" name="Active users" unit="%" max={100} xTitle="Active users (%)" yTitle="Feature"
            colorFor={(r) => (r.share < 30 ? STATUS.warn : undefined)} />}
        </Section>
      </Grid>

      <Grid>
        <Section id="modelHealth" title="AI model health" info="Coverage, freshness, speed and failure rate of AI scoring.">{statusItems}</Section>
        <Section id="compliance" title="Compliance alerts" info="Consent and do-not-contact enforcement across the organisation.">{statusItems}</Section>
      </Grid>

      <Grid>
        <Section id="aiFeatures" title="AI feature switches" subtitle="Read only here; change them in Settings"
          info="Which AI features are switched on for the organisation.">
          {(rows) => (
            <ul className="divide-y divide-border">
              {rows.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">{f.enabled ? 'On' : 'Off'}<Switch checked={f.enabled} disabled aria-label={f.name} /></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section id="subscriptionUsage" title="Subscription and usage" info="Usage this billing period against the plan’s limits." action={<ManagePlanLink />}>
          {usageMeters}
        </Section>
      </Grid>

      <Section id="auditActivity" title="Recent audit activity" info="The latest setting changes, exports, overrides and approvals.">
        {(rows) => <ItemList items={rows.map((a) => ({ title: a.action, detail: `${a.who} · ${a.when}`, right: <StatusBadge label={a.kind[0]} tone={a.kind[1]} /> }))} />}
      </Section>
    </div>
  );
}
