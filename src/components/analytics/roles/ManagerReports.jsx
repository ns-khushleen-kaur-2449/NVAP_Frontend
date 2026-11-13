import { ColumnChart, DataTable, FunnelChart, HBarChart, LineTrendChart, SERIES, STATUS, StackedHBarChart } from '../charts';
import { Grid, KpiRow, Section, SectionTitle } from '../Section';
import { CHANNEL_SERIES, OUTCOME_SERIES, SENT_SERIES, funnelTable, tableOf } from './common';

export const MANAGER_REPORT_SECTIONS = [
  ['reportKpis', 'Key metrics'], ['slaTrend', 'Team SLA trend'], ['responseByRep', 'Response time by rep'], ['reportFunnel', 'Team funnel'],
  ['repConversion', 'Rep-wise conversion'], ['scoreBands', 'Conversion by score band'], ['missedLeads', 'Missed high-priority leads'],
  ['campaignPerformance', 'Campaign performance'], ['channelPerformance', 'Channel performance'], ['repActivity', 'Activity by rep'],
  ['repMeetingOutcomes', 'Meeting outcomes by rep'], ['repPerformance', 'Rep performance'],
];
const hoursText = (h) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

/** Sales Manager reports: the manager's own team, for the selected filters. */
export default function ManagerReports() {
  return (
    <div className="space-y-4">
      <SectionTitle n="1">Response time and SLA</SectionTitle>
      <KpiRow id="reportKpis" ids={['response', 'responseSla', 'followUpSla', 'overdue']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="slaTrend" title="Team SLA trend" info="Share of the team’s first replies and follow-ups done within their target time, per day.">
          {(rows) => (
            <LineTrendChart data={rows} x="date" xTitle="Date" yTitle="On time (%)" unit="%" domain={[0, 100]} goal={80}
              series={[{ key: 'response', name: 'Response SLA', color: SERIES[0] }, { key: 'followUp', name: 'Follow-up SLA', color: SERIES[1] }]} />
          )}
        </Section>
        <Section id="responseByRep" title="Response time by rep" subtitle="Lower is better; the slowest rep is marked"
          info="Each rep’s average time from a prospect’s message to the first reply."
          table={tableOf(['Rep', 'Average time to first reply'], (r) => [r.rep, hoursText(r.hours)], [1])}>
          {(rows) => {
            const slowest = Math.max(...rows.map((r) => r.hours));
            return <HBarChart data={rows} category="rep" value="hours" name="Avg hours to first reply" unit="h" xTitle="Average time to first reply (hours)" yTitle="Rep"
              valueText={hoursText} colorFor={(r) => (r.hours === slowest ? STATUS.bad : undefined)} />;
          }}
        </Section>
      </Grid>

      <SectionTitle n="2">Funnel and rep-wise conversion</SectionTitle>
      <Grid>
        <Section id="reportFunnel" title="Team funnel drop-off" subtitle="The red bar is the stage that loses the most prospects"
          info="How many of the team’s prospects reached each stage, and how many the stage before lost." table={funnelTable}>
          {(stages) => <FunnelChart stages={stages} highlightLargestDrop />}
        </Section>
        <Section id="repConversion" title="Rep-wise conversion" info="Share of each rep’s prospects that became an opportunity."
          table={tableOf(['Rep', 'Converted'], (r) => [r.rep, `${r.rate}%`], [1])}>
          {(rows) => <HBarChart data={rows} category="rep" value="rate" name="Converted" unit="%" xTitle="Prospects converted (%)" yTitle="Rep" />}
        </Section>
      </Grid>

      <SectionTitle n="3">AI scoring performance</SectionTitle>
      <Grid>
        <Section id="scoreBands" title="Actual conversion by score band" info="Share of the team’s prospects in each AI score band that became an opportunity."
          table={tableOf(['Score band', 'Became an opportunity'], (r) => [r.band, `${r.rate}%`], [1])}>
          {(rows) => <HBarChart data={rows} category="band" value="rate" name="Converted" unit="%" xTitle="Became an opportunity (%)" yTitle="AI score band" />}
        </Section>
        <Section id="missedLeads" title="Missed high-priority leads" subtitle="Score 80+" info="Prospects scored 80 or more that were never contacted, or first contacted after the deadline.">
          {(rows) => <DataTable numeric={[1, 2]} minWidth={320} columns={['Rep', 'Never contacted', 'Contacted too late']} rows={rows.map((r) => [r.rep, r.neverContacted, r.contactedLate])} />}
        </Section>
      </Grid>

      <SectionTitle n="4">Campaign, channel and activity</SectionTitle>
      <Grid>
        <Section id="campaignPerformance" title="Meetings booked by campaign" info="Meetings booked from each of the team’s campaigns."
          table={tableOf(['Campaign', 'Meetings', 'Conversions'], (r) => [r.campaign, r.meetings, r.conversions], [1, 2])}>
          {(rows) => <HBarChart data={rows} category="campaign" value="meetings" name="Meetings booked" xTitle="Meetings booked (count)" yTitle="Campaign" />}
        </Section>
        <Section id="channelPerformance" title="Results by channel" info="Responses, meetings and conversions each channel produced for the team."
          table={tableOf(['Channel', 'Responses', 'Meetings', 'Conversions'], (r) => [r.channel, r.responses, r.meetings, r.conversions], [1, 2, 3])}>
          {(rows) => <ColumnChart data={rows} x="channel" series={CHANNEL_SERIES} xTitle="Channel" yTitle="Count" />}
        </Section>
      </Grid>
      <Section id="repActivity" title="Activity by rep" info="Calls, emails and SMS each rep sent in the period."
        table={tableOf(['Rep', 'Calls', 'Emails', 'SMS'], (r) => [r.rep, r.calls, r.emails, r.sms], [1, 2, 3])}>
        {(rows) => <StackedHBarChart data={rows} category="rep" series={SENT_SERIES} xTitle="Calls and messages sent (count)" yTitle="Rep" />}
      </Section>

      <SectionTitle n="5">Meeting analytics</SectionTitle>
      <KpiRow id="reportKpis" ids={['showRate', 'lost', 'meetingToOpp', 'conversionRate']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Section id="repMeetingOutcomes" title="Meeting outcomes by rep" info="What happened to the meetings each rep booked."
        table={tableOf(['Rep', 'Completed', 'Rescheduled', 'Cancelled', 'No-show'], (r) => [r.rep, r.completed, r.rescheduled, r.cancelled, r.noShow], [1, 2, 3, 4])}>
        {(rows) => <StackedHBarChart data={rows} category="rep" series={OUTCOME_SERIES} xTitle="Meetings (count)" yTitle="Rep" />}
      </Section>

      <SectionTitle n="6">Rep performance</SectionTitle>
      <Section id="repPerformance" title="All reps" info="Each rep’s results and current workload (active prospects).">
        {(rows) => (
          <DataTable numeric={[1, 3, 4, 5]} minWidth={560} columns={['Rep', 'Contacted', 'Avg response', 'Meetings', 'Conversions', 'Workload']}
            rows={rows.map((r) => [r.rep, r.contacted, r.avgResponse, r.meetings, r.conversions, r.workload])} />
        )}
      </Section>
    </div>
  );
}
