import StatusBadge from '@/components/ops/StatusBadge';
import { ColumnChart, DataTable, DonutChart, FunnelChart, HBarChart, LineTrendChart, SERIES, STATUS } from '../charts';
import { Grid, KpiRow, Section, SectionTitle } from '../Section';
import { funnelTable, tableOf } from './common';
import { ManagePlanLink, usageMeters } from './AdminDashboard';

export const ADMIN_REPORT_SECTIONS = [
  ['reportKpis', 'Key metrics'], ['reportFunnel', 'Tenant funnel'], ['teamPerformance', 'Team performance'], ['aiCost', 'AI cost by feature'],
  ['scoringCalibration', 'Scoring calibration'], ['scoreFreshness', 'Score freshness'], ['adoptionTrend', 'Feature adoption trend'],
  ['integrationFailures', 'Failures by service'], ['failureLog', 'Failure log'], ['consentStatus', 'Consent status'],
  ['auditLog', 'Audit log'], ['planUsage', 'Usage against plan'],
];
const FEATURE_SERIES = [
  { key: 'scoring', name: 'Scoring', color: SERIES[0] }, { key: 'intent', name: 'Intent', color: SERIES[1] },
  { key: 'filtering', name: 'Filtering', color: SERIES[2] }, { key: 'scheduling', name: 'Scheduling', color: SERIES[3] },
  { key: 'insights', name: 'Insights', color: SERIES[4] },
];
const SERVICE_SERIES = [
  { key: 'voice', name: 'Voice', color: SERIES[0] }, { key: 'calendar', name: 'Calendar', color: SERIES[1] },
  { key: 'prospectData', name: 'Prospect data', color: SERIES[2] }, { key: 'outboundEvents', name: 'Outbound events', color: SERIES[3] },
];
const CONSENT_COLORS = { Consented: STATUS.good, 'No consent record': STATUS.warn, 'Opted out': STATUS.muted, 'Do-not-contact': STATUS.bad };

/** Tenant Admin reports: the whole organisation, for the selected filters. */
export default function AdminReports() {
  return (
    <div className="space-y-4">
      <SectionTitle n="1">Funnel, teams and conversion</SectionTitle>
      <KpiRow id="reportKpis" ids={['conversionRate', 'responseSla']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="reportFunnel" title="Tenant funnel drop-off" subtitle="The red bar is the stage that loses the most prospects"
          info="How many of the organisation’s prospects reached each stage, and how many the stage before lost." table={funnelTable}>
          {(stages) => <FunnelChart stages={stages} highlightLargestDrop />}
        </Section>
        <Section id="teamPerformance" title="Team performance comparison" info="Each team’s conversion rate, with the meetings it booked."
          table={tableOf(['Team', 'Conversion', 'Meetings'], (r) => [r.team, `${r.rate}%`, r.meetings], [1, 2])}>
          {(rows) => <HBarChart data={rows} category="team" value="rate" name="Conversion rate" unit="%" xTitle="Conversion rate (%)" yTitle="Team" />}
        </Section>
      </Grid>

      <SectionTitle n="2">AI cost</SectionTitle>
      <KpiRow id="reportKpis" ids={['aiCost', 'costPerMeeting']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Section id="aiCost" title="AI cost by feature" info="AI spend per day, split by the feature that used it.">
        {(rows) => <ColumnChart stacked data={rows} x="day" prefix="$" series={FEATURE_SERIES} xTitle="Day of week" yTitle="AI cost ($)" />}
      </Section>

      <SectionTitle n="3">AI scoring and model quality</SectionTitle>
      <KpiRow id="reportKpis" ids={['coverage', 'stale']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Grid>
        <Section id="scoringCalibration" title="Scoring calibration" info="Conversion the AI score predicted against what happened, per score band. Close bars mean the score can be trusted."
          table={tableOf(['Score band', 'Predicted', 'Actual'], (r) => [r.band, `${r.predicted}%`, `${r.actual}%`], [1, 2])}>
          {(rows) => <ColumnChart data={rows} x="band" unit="%" xTitle="AI score band" yTitle="Conversion (%)"
            series={[{ key: 'predicted', name: 'Predicted', color: SERIES[0] }, { key: 'actual', name: 'Actual', color: SERIES[1] }]} />}
        </Section>
        <Section id="scoreFreshness" title="Score freshness by week" info="Prospects with a current score, a stale score, or none, per week."
          table={tableOf(['Week', 'Fresh', 'Stale', 'Not scored'], (r) => [r.week, r.fresh, r.stale, r.notScored], [1, 2, 3])}>
          {(rows) => <ColumnChart stacked data={rows} x="week" xTitle="Week" yTitle="Prospects (count)" series={[
            { key: 'fresh', name: 'Fresh', color: STATUS.good }, { key: 'stale', name: 'Stale', color: STATUS.warn }, { key: 'notScored', name: 'Not scored', color: STATUS.muted },
          ]} />}
        </Section>
      </Grid>

      <SectionTitle n="4">Feature adoption</SectionTitle>
      <KpiRow id="reportKpis" ids={['adoption']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Section id="adoptionTrend" title="Adoption trend" info="Share of active users who used each AI feature, per week.">
        {(rows) => <LineTrendChart data={rows} x="week" unit="%" domain={[0, 100]} xTitle="Week" yTitle="Active users (%)" series={[
          { key: 'scoring', name: 'Lead scoring', color: SERIES[0] }, { key: 'intent', name: 'Intent', color: SERIES[1] }, { key: 'scheduling', name: 'Scheduling', color: SERIES[2] },
        ]} />}
      </Section>

      <SectionTitle n="5">Integrations</SectionTitle>
      <KpiRow id="reportKpis" ids={['integrationRate', 'integrationFailures']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Grid>
        <Section id="integrationFailures" title="Failures by service" info="Failed events per day, by connected service."
          table={tableOf(['Day', ...SERVICE_SERIES.map((s) => s.name)], (r) => [r.day, ...SERVICE_SERIES.map((s) => r[s.key])], [1, 2, 3, 4])}>
          {(rows) => <ColumnChart stacked data={rows} x="day" series={SERVICE_SERIES} xTitle="Day of week" yTitle="Failed events (count)" />}
        </Section>
        <Section id="failureLog" title="Failure log" info="Recent failed events, how often each was retried, and where it stands."
          empty={{ title: 'No failures', body: 'Every connected service is working.' }}>
          {(rows) => <DataTable numeric={[2]} minWidth={400} columns={['Service', 'Error', 'Retries', 'State']}
            rows={rows.map((r) => [r.service, r.error, r.retries, <StatusBadge key="s" label={r.state[0]} tone={r.state[1]} />])} />}
        </Section>
      </Grid>

      <SectionTitle n="6">Compliance and audit</SectionTitle>
      <Grid>
        <Section id="consentStatus" title="Consent status" info="Prospects by consent state. Opted-out and do-not-contact prospects are never contacted."
          table={tableOf(['Status', 'Prospects'], (r) => [r.status, r.count], [1])}>
          {(rows) => <DonutChart data={rows} nameKey="status" unit="prospects" label="Consent status" colors={rows.map((r) => CONSENT_COLORS[r.status] || STATUS.muted)} />}
        </Section>
        <Section id="auditLog" title="Audit log" info="Who changed settings, exported data, overrode the AI or approved work.">
          {(rows) => <DataTable minWidth={400} columns={['When', 'Who', 'Action']} rows={rows.map((r) => [r.when, r.who, r.action])} />}
        </Section>
      </Grid>

      <SectionTitle n="7">Usage against plan</SectionTitle>
      <Section id="planUsage" title="Usage vs plan limits" info="Usage this billing period against the plan’s limits." action={<ManagePlanLink />}>
        {usageMeters}
      </Section>
    </div>
  );
}
