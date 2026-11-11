import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/ops/StatusBadge';
import { DataTable, FunnelChart, ItemList } from '../charts';
import { Grid, KpiRow, Section } from '../Section';
import { ActionLink, FullAnalysisLink, ScoreBadge, campaignRows, funnelTable } from './common';

function PriorityTable({ rows }) {
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(open === i ? null : i);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            {['Prospect', 'Score', 'Intent', 'Next action', 'Last touch'].map((c) => <th key={c} scope="col" className="px-2 py-2 font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <Fragment key={p.name}>
              <tr tabIndex={0} aria-expanded={open === i} onClick={() => toggle(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); } }}
                className="cursor-pointer border-b border-border hover:bg-[hsl(var(--surface-2))]">
                <td className="px-2 py-2.5">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.title}</p>
                  {p.blocked && <StatusBadge label={p.blocked} tone="bad" className="mt-1" />}
                </td>
                <td className="px-2 py-2.5"><ScoreBadge score={p.score} /></td>
                <td className="px-2 py-2.5"><StatusBadge label={p.intent} tone="info" /></td>
                <td className="px-2 py-2.5"><StatusBadge label={p.nextAction} tone="accent" /></td>
                <td className="px-2 py-2.5 text-muted-foreground">{p.lastTouch}</td>
              </tr>
              {open === i && (
                <tr className="border-b border-border bg-[hsl(var(--surface-2))]">
                  <td colSpan={5} className="px-3 py-2 text-xs text-muted-foreground"><strong className="text-foreground">Why this score:</strong> {p.why}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sales Rep dashboard: today's work on their own prospects. */
export default function RepDashboard() {
  return (
    <div className="space-y-4">
      <Section id="actionItems" title="Needs you" info="Items waiting on you: handoffs, callbacks, reviews and approvals, most urgent first."
        empty={{ title: 'Nothing needs you right now', body: 'New handoffs, callbacks and reviews will appear here.' }}>
        {(items) => <ItemList items={items.map((it) => ({ ...it, right: <ActionLink item={it} /> }))} />}
      </Section>

      <KpiRow />

      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="priorityProspects" title="Priority prospects" subtitle="Select a row to see why it scored that way"
          info="Your prospects ranked by AI score and recent intent." empty={{ title: 'No priority prospects', body: 'Prospects with a high score or fresh intent appear here.' }}>
          {(rows) => <PriorityTable rows={rows} />}
        </Section>
        <Section id="upcomingMeetings" title="Upcoming meetings" info="Your next booked meetings and who booked them."
          action={<Link to="/meetings" className="text-xs font-semibold text-[color:var(--ops-accent-ink)] hover:underline">All meetings →</Link>}
          empty={{ title: 'No upcoming meetings', body: 'Meetings booked by you or the AI appear here.' }}>
          {(rows) => <ItemList items={rows.map((m) => ({ title: m.who, detail: m.detail, right: <StatusBadge label={m.source[0]} tone={m.source[1]} /> }))} />}
        </Section>
      </Grid>

      <Grid cols="lg:grid-cols-[1.4fr_1fr]">
        <Section id="nextBestActions" title="AI next-best actions" subtitle="Top 3, ranked by score and urgency"
          info="What the AI suggests you do next, based on each prospect’s score, intent and last contact.">
          {(rows) => <ItemList items={rows.map((a) => ({ title: a.title, detail: a.detail, right: <ActionLink item={{ ...a, primary: true }} /> }))} />}
        </Section>
        <Section id="funnel" title="My funnel" subtitle="Prospects at each stage" info="How many of your prospects reached each stage in the period."
          action={<FullAnalysisLink />} table={funnelTable}>
          {(stages) => <FunnelChart stages={stages} />}
        </Section>
      </Grid>

      <Grid cols="lg:grid-cols-[1fr_1.4fr]">
        <Section id="conversationFeed" title="Live conversation feed" info="The latest conversations with your prospects and what they asked for."
          action={<StatusBadge label="Real-time" tone="good" />} empty={{ title: 'No conversations yet', body: 'New replies and calls appear here as they happen.' }}>
          {(rows) => <ItemList items={rows.map((f) => ({ title: f.who, detail: f.at, right: <StatusBadge label={f.label} tone={f.tone} /> }))} />}
        </Section>
        <Section id="campaigns" title="My campaigns" info="Campaigns your prospects are in, with what each produced.">
          {(rows) => <DataTable numeric={[3, 4, 5]} columns={['Campaign', 'Channels', 'Status', 'Contacted', 'Meetings', 'Conv.']} rows={campaignRows(rows)} minWidth={480} />}
        </Section>
      </Grid>
    </div>
  );
}
