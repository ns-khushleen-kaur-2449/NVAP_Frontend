import StatusBadge from '@/components/ops/StatusBadge';
import { ColumnChart, DonutChart, FunnelChart, HBarChart, ItemList, LineTrendChart, SERIES, STATUS } from '../charts';
import { Grid, KpiRow, Section, SectionTitle } from '../Section';
import { CHANNEL_SERIES, OUTCOME_COLORS, SENT_SERIES, funnelTable, tableOf } from './common';

// What the CSV export contains, in page order.
export const REP_REPORT_SECTIONS = [
  ['reportKpis', 'Key metrics'], ['slaTrend', 'SLA trend'], ['lateItems', 'Late items'], ['reportFunnel', 'Funnel'],
  ['scoreBands', 'Conversion by score band'], ['missedLeads', 'Missed high-priority leads'],
  ['campaignPerformance', 'Campaign performance'], ['channelPerformance', 'Channel performance'],
  ['meetingOutcomes', 'Meeting outcomes'], ['dailyActivity', 'Daily activity'], ['intentMix', 'Intent mix'],
];
const INTENT_COLORS = [STATUS.muted, SERIES[0], STATUS.bad, STATUS.good, SERIES[1], SERIES[3]];

/** Sales Rep reports: the rep's own prospects and activity, for the selected filters. */
export default function RepReports() {
  return (
    <div className="space-y-4">
      <SectionTitle n="1">Lead response time and SLA</SectionTitle>
      <KpiRow id="reportKpis" ids={['response', 'responseSla', 'followUpSla', 'overdue']} cols="sm:grid-cols-2 xl:grid-cols-4" />
      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="slaTrend" title="SLA trend" info="Share of first replies and follow-ups done within their target time, per day.">
          {(rows) => (
            <LineTrendChart data={rows} x="date" xTitle="Date" yTitle="On time (%)" unit="%" domain={[0, 100]} goal={80}
              series={[{ key: 'response', name: 'Response SLA', color: SERIES[0] }, { key: 'followUp', name: 'Follow-up SLA', color: SERIES[1] }]} />
          )}
        </Section>
        <Section id="lateItems" title="Late items" info="Your items past their deadline, most overdue first. Handoffs are not included until their due times are recorded."
          empty={{ title: 'Nothing is late', body: 'Every follow-up is on time.' }}>
          {(rows) => <ItemList items={rows.map((l) => ({ title: l.who, detail: l.what, right: <StatusBadge label={l.late} tone="bad" /> }))} />}
        </Section>
      </Grid>

      <SectionTitle n="2">Funnel drop-off</SectionTitle>
      <Section id="reportFunnel" title="Prospects at each stage" subtitle="The red bar is the stage that loses the most prospects"
        info="How many of your prospects reached each stage, and how many the stage before lost." table={funnelTable}>
        {(stages) => <FunnelChart stages={stages} highlightLargestDrop />}
      </Section>

      <SectionTitle n="3">AI scoring performance</SectionTitle>
      <Grid>
        <Section id="scoreBands" title="Actual conversion by score band" info="Share of prospects in each AI score band that became an opportunity."
          table={tableOf(['Score band', 'Became an opportunity'], (r) => [r.band, `${r.rate}%`], [1])}>
          {(rows) => <HBarChart data={rows} category="band" value="rate" name="Converted" unit="%" xTitle="Became an opportunity (%)" yTitle="AI score band" />}
        </Section>
        <Section id="missedLeads" title="Missed high-priority leads" info="Prospects scored 80 or more that were never contacted, or first contacted after the deadline.">
          {([m]) => (
            <ItemList items={[
              { title: 'Never contacted', detail: 'Score 80+, no outreach yet', right: <StatusBadge label={String(m.neverContacted)} tone="bad" /> },
              { title: 'Contacted too late', detail: 'Score 80+, first reply after the deadline', right: <StatusBadge label={String(m.contactedLate)} tone="warn" /> },
            ]} />
          )}
        </Section>
      </Grid>

      <SectionTitle n="4">Campaign and channel performance</SectionTitle>
      <Grid>
        <Section id="campaignPerformance" title="Meetings booked by campaign" info="Meetings booked from each campaign in the period."
          table={tableOf(['Campaign', 'Meetings', 'Conversions'], (r) => [r.campaign, r.meetings, r.conversions], [1, 2])}>
          {(rows) => <HBarChart data={rows} category="campaign" value="meetings" name="Meetings booked" xTitle="Meetings booked (count)" yTitle="Campaign" />}
        </Section>
        <Section id="channelPerformance" title="Results by channel" info="Responses, meetings and conversions each channel produced."
          table={tableOf(['Channel', 'Responses', 'Meetings', 'Conversions'], (r) => [r.channel, r.responses, r.meetings, r.conversions], [1, 2, 3])}>
          {(rows) => <ColumnChart data={rows} x="channel" series={CHANNEL_SERIES} xTitle="Channel" yTitle="Count" />}
        </Section>
      </Grid>

      <SectionTitle n="5">Meeting analytics</SectionTitle>
      <KpiRow id="reportKpis" ids={['showRate', 'lost', 'meetingToOpp']} cols="sm:grid-cols-3" />
      <Section id="meetingOutcomes" title="Meeting outcomes" info="What happened to the meetings booked in the period."
        table={tableOf(['Outcome', 'Meetings'], (r) => [r.outcome, r.count], [1])}>
        {(rows) => <DonutChart data={rows} nameKey="outcome" unit="meetings" label="Meeting outcomes" colors={rows.map((r) => OUTCOME_COLORS[r.outcome] || STATUS.muted)} />}
      </Section>

      <SectionTitle n="6">Daily activity</SectionTitle>
      <Grid cols="lg:grid-cols-[1.6fr_1fr]">
        <Section id="dailyActivity" title="Calls, emails and SMS sent" info="Outreach you sent each day, by channel."
          table={tableOf(['Day', 'Calls', 'Emails', 'SMS', 'Meetings booked'], (r) => [r.day, r.calls, r.emails, r.sms, r.meetings], [1, 2, 3, 4])}>
          {(rows) => <ColumnChart stacked data={rows} x="day" series={SENT_SERIES} xTitle="Day of week" yTitle="Sent (count)" />}
        </Section>
        <Section id="dailyActivity" title="Meetings booked per day" info="Meetings booked each day. Shown apart from outreach because the counts use a different scale.">
          {(rows) => <ColumnChart data={rows} x="day" series={[{ key: 'meetings', name: 'Meetings booked', color: SERIES[1] }]} xTitle="Day of week" yTitle="Meetings (count)" />}
        </Section>
      </Grid>

      <SectionTitle n="7">Intent mix</SectionTitle>
      <Section id="intentMix" title="What prospects said" subtitle="A large “No answer” share points to timing; a large “Not interested” share points to targeting."
        info="The intent the AI assessed for each conversation in the period."
        table={tableOf(['Intent', 'Conversations'], (r) => [r.intent, r.count], [1])}>
        {(rows) => <DonutChart data={rows} nameKey="intent" unit="conversations" label="Intent mix" colors={INTENT_COLORS} />}
      </Section>
    </div>
  );
}
