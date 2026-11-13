/**
 * Stand-in answers for endpoints marked source: 'mock' in endpoints.js, one set per scope, in the shape the real
 * endpoint will return. Keyed by the scope the backend would apply (rep / manager / tenant), which only this
 * mock needs: a real call never sends the role. Figures come from the design-review files.
 */
import { UNAVAILABLE_REASON } from './endpoints';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
const byDay = (rows, keys) => rows.map((v, i) => ({ day: DAYS[i], ...Object.fromEntries(keys.map((k, j) => [k, v[j]])) }));
const stages = (pairs) => pairs.map(([stage, count]) => ({ stage, count }));

const kpi = (id, label, value, delta, tone, trend, extra = {}) => ({ id, label, value, delta, tone, trend, ...extra });
const unavailable = (id, label, reason, info) => ({ id, label, unavailable: reason, info });

const DEF = {
  contacted: 'Prospects who received at least one call, email or SMS in the period.',
  answerRate: 'Calls answered by a person ÷ calls placed.',
  response: 'Time from a prospect’s message or a new lead to the first reply, averaged.',
  hot: 'Prospects with an AI score of 80 or more.',
  meetings: 'Meetings booked in the period, by the AI or by a person.',
  conversions: 'Prospects moved to Opportunity in the period.',
  responseSla: 'First replies sent within the target time ÷ all first replies.',
  followUpSla: 'Follow-ups done by their due time ÷ all follow-ups that were due.',
  overdue: 'Items past their deadline and not yet done. Handoffs are not included until their due times are recorded.',
  conversionRate: 'Opportunities ÷ prospects in scope.',
  showRate: 'Completed meetings ÷ booked meetings.',
  lost: 'Meetings cancelled or missed ÷ booked.',
  meetingToOpp: 'Opportunities ÷ completed meetings.',
  activeUsers: 'Users who signed in during the period ÷ seats.',
  aiCost: 'Total AI spend in the period.',
  aiFailure: 'AI requests that failed ÷ all AI requests.',
  integrationFailures: 'Failed events with connected services that are not resolved.',
  coverage: 'Prospects with a current AI score ÷ all prospects.',
  stale: 'Prospects whose score is older than the refresh window.',
  integrationRate: 'Failed events ÷ all events with connected services.',
  costPerMeeting: 'AI cost ÷ meetings booked.',
  adoption: 'Active users using at least one AI feature ÷ active users.',
};

const AUDIT = [
  { when: '10 min ago', who: 'Priya N. (Admin)', action: 'Scoring threshold changed', kind: ['Setting', 'info'] },
  { when: '1 h ago', who: 'Anita R. (Manager)', action: 'CSV export, 212 prospects', kind: ['Export', 'neutral'] },
  { when: '3 h ago', who: 'Dev S. (Rep)', action: 'AI intent overridden', kind: ['Override', 'warn'] },
  { when: '5 h ago', who: 'Anita R. (Manager)', action: 'Campaign strategy approved', kind: ['Approval', 'good'] },
];
const TEAM_FUNNEL = stages([['Prospects', 640], ['Contacted', 512], ['Responded', 290], ['Qualified', 118], ['Meeting booked', 52], ['Meeting completed', 38], ['Opportunity', 17]]);
const SCORE_BANDS = [{ band: '80 and above', rate: 31 }, { band: '60 to 79', rate: 14 }, { band: 'Below 60', rate: 4 }];

const rep = {
  kpis: [
    kpi('contacted', 'Prospects contacted', '84', '+12% vs last week', 'good', [40, 52, 48, 60, 66, 72, 84], { info: DEF.contacted }),
    kpi('answerRate', 'Answer rate', '41%', '+5 pts', 'good', [30, 34, 33, 38, 36, 40, 41], { info: DEF.answerRate, unit: '%' }),
    kpi('response', 'Avg response time', '2h 40m', '−18 min, lower is better', 'good', [190, 200, 185, 175, 180, 170, 160], { info: DEF.response, unit: ' min', note: '5 overdue' }),
    kpi('hot', 'Hot prospects', '9', '+2 vs last week', 'good', [4, 5, 5, 6, 7, 8, 9], { info: DEF.hot, note: '4 not yet contacted' }),
    kpi('meetings', 'Meetings booked', '6', '+1 vs last week', 'good', [1, 0, 2, 1, 3, 2, 6], { info: DEF.meetings, bar: true, note: '4 completed' }),
    kpi('conversions', 'Conversions', '2', 'Same as last week', 'neutral', [0, 1, 0, 1, 1, 2, 2], { info: DEF.conversions, note: 'Opportunities' }),
  ],
  actionItems: [
    { title: 'Handoff request', badge: ['Urgent', 'bad'], detail: 'Priya Nair · the AI could not answer a product question', action: 'Take over', href: '/inbox', primary: true },
    { title: 'Overdue follow-up', badge: ['Urgent', 'bad'], detail: 'Kiran Autos · 3 hours past the deadline', action: 'Call now', href: '/operations/callbacks' },
    { title: 'Callback due', badge: ['Due today', 'warn'], detail: 'Rohan Mehta · asked for a call at 4 PM', action: 'Call now', href: '/operations/callbacks' },
    { title: 'Intent review', badge: ['Open', 'warn'], detail: 'Sam Ortiz · said “not now”, then “send a demo”', action: 'Review', href: '/operations/intent-review' },
    { title: 'Conversion approval', badge: ['Waiting', 'info'], detail: 'Acme Motors · Qualified → Opportunity', action: 'View', href: '/conversion' },
  ],
  priorityProspects: [
    { name: 'Sarah Lin', title: 'VP Ops · Auto Parts Co.', score: 86, intent: 'Demo request', nextAction: 'Book meeting', lastTouch: '1h ago', why: 'Asked for a demo, opened 3 emails, VP title.' },
    { name: 'Vikram Rao', title: 'CTO · Torque Systems', score: 81, intent: 'Pricing', nextAction: 'Call now', lastTouch: '2h ago', why: 'Asked about pricing; strong job fit.' },
    { name: 'Elena Petrov', title: 'Dir. Sales · Nexa Motors', score: 74, intent: 'Info request', nextAction: 'Send email', lastTouch: '1d ago', blocked: 'SMS blocked', why: 'Replied once; mid-size company.' },
    { name: 'Arjun Singh', title: 'IT Head · Kiran Autos', score: 68, intent: 'Interested', nextAction: 'Follow up Thu', lastTouch: '2d ago', why: 'Positive reply, no meeting yet.' },
    { name: 'Maya Iyer', title: 'COO · DriveWorks', score: 55, intent: 'Neutral', nextAction: 'Nurture', lastTouch: '5d ago', blocked: 'Do not call', why: 'Low engagement.' },
  ],
  upcomingMeetings: [
    { who: 'Sarah Lin', detail: 'Tue 3:30 PM · Demo · R. Kapoor', source: ['AI-booked', 'accent'] },
    { who: 'Vikram Rao', detail: 'Wed 11:00 AM · Discovery · A. Shah', source: ['AI-booked', 'accent'] },
    { who: 'Acme Motors', detail: 'Wed 4:00 PM · Proposal · R. Kapoor', source: ['Manual', 'neutral'] },
    { who: 'Nexa Motors', detail: 'Thu 10:30 AM · Demo · A. Shah', source: ['Reminder sent', 'good'] },
  ],
  nextBestActions: [
    { title: 'Call Vikram Rao now', detail: 'Asked about pricing 2 hours ago. Score 81.', action: 'Call', href: '/voice_agent?tab=single' },
    { title: 'Book a demo with Sarah Lin', detail: 'Requested a demo; no slot offered yet. Score 86.', action: 'Offer slots', href: '/meetings' },
    { title: 'Email Elena Petrov', detail: 'Replied yesterday; SMS is blocked, so use email. Score 74.', action: 'Draft email', href: '/inbox' },
  ],
  funnel: stages([['Contacted', 84], ['Responded', 41], ['Qualified', 18], ['Meeting', 6], ['Opportunity', 2]]),
  conversationFeed: [
    { who: 'Sarah Lin', label: 'Demo request · High', tone: 'good', at: '19:06' },
    { who: 'Vikram Rao', label: 'Pricing · Medium', tone: 'info', at: '19:02' },
    { who: 'Priya Nair', label: 'Handoff requested', tone: 'bad', at: '18:57' },
    { who: 'Arjun Singh', label: 'Callback · High', tone: 'warn', at: '18:50' },
    { who: 'Elena Petrov', label: 'Not interested · High', tone: 'neutral', at: '18:41' },
  ],
  campaigns: [
    { name: 'Auto Mfg – India', channels: 'Email → Voice', status: ['Active', 'good'], contacted: 42, meetings: 4, conversions: 1 },
    { name: 'SaaS Mid-Market', channels: 'Voice → Email', status: ['Active', 'good'], contacted: 31, meetings: 2, conversions: 1 },
    { name: 'Pilot Re-engage', channels: 'Voice', status: ['Pending approval', 'warn'], contacted: 0, meetings: 0, conversions: 0 },
  ],

  reportKpis: [
    kpi('response', 'Avg response time', '2h 40m', 'Lower is better', 'good', null, { info: DEF.response }),
    unavailable('responseSla', 'Response SLA', UNAVAILABLE_REASON.sla, DEF.responseSla),
    unavailable('followUpSla', 'Follow-up SLA', UNAVAILABLE_REASON.sla, DEF.followUpSla),
    kpi('overdue', 'Overdue items', '5', 'Open now', 'bad', null, { info: DEF.overdue }),
    kpi('showRate', 'Show rate', '78%', 'Completed ÷ booked', 'good', null, { info: DEF.showRate }),
    kpi('lost', 'No-shows & cancellations', '4', '22% of booked', 'bad', null, { info: DEF.lost }),
    kpi('meetingToOpp', 'Meeting → opportunity', '43%', 'Opportunities ÷ completed', 'good', null, { info: DEF.meetingToOpp }),
  ],
  lateItems: [
    { who: 'Sam Ortiz', what: 'Intent review', late: '1d late' }, { who: 'Priya Nair', what: 'Reply to pricing question', late: '6h late' },
    { who: 'Kiran Autos', what: 'Callback', late: '3h late' }, { who: 'Rohan Mehta', what: 'Callback', late: '40m late' },
  ],
  reportFunnel: stages([['Prospects', 214], ['Contacted', 168], ['Responded', 96], ['Qualified', 41], ['Meeting booked', 18], ['Meeting completed', 14], ['Opportunity', 6]]),
  scoreBands: SCORE_BANDS,
  missedLeads: [{ rep: null, neverContacted: 4, contactedLate: 3 }],
  campaignPerformance: [
    { campaign: 'Auto Mfg – India', meetings: 4, conversions: 1 }, { campaign: 'SaaS Mid-Market', meetings: 2, conversions: 1 },
    { campaign: 'Pilot Re-engage', meetings: 0, conversions: 0 },
  ],
  channelPerformance: [
    { channel: 'Call', responses: 41, meetings: 4, conversions: 1 }, { channel: 'Email', responses: 38, meetings: 3, conversions: 1 },
    { channel: 'SMS', responses: 12, meetings: 1, conversions: 0 },
  ],
  meetingOutcomes: [{ outcome: 'Completed', count: 14 }, { outcome: 'Rescheduled', count: 3 }, { outcome: 'Cancelled', count: 2 }, { outcome: 'No-show', count: 2 }],
  dailyActivity: byDay([[14, 22, 6, 1], [18, 20, 8, 0], [12, 26, 5, 2], [20, 18, 9, 1], [16, 24, 7, 2], [4, 6, 1, 0], [2, 3, 0, 0]], ['calls', 'emails', 'sms', 'meetings']),
  intentMix: [
    { intent: 'No answer', count: 64 }, { intent: 'Info request', count: 31 }, { intent: 'Not interested', count: 22 },
    { intent: 'Demo request', count: 18 }, { intent: 'Pricing', count: 14 }, { intent: 'Callback', count: 9 },
  ],
};

const REPS = ['Anita R.', 'Dev S.', 'Meera K.', 'Raj P.'];
const manager = {
  kpis: [
    kpi('contacted', 'Prospects contacted', '312', '+9% vs last week', 'good', [210, 230, 240, 260, 280, 300, 312], { info: DEF.contacted }),
    kpi('answerRate', 'Answer rate', '39%', '+2 pts', 'good', [34, 35, 36, 36, 38, 38, 39], { info: DEF.answerRate, unit: '%' }),
    unavailable('responseSla', 'Response SLA', UNAVAILABLE_REASON.sla, DEF.responseSla),
    kpi('hotNotContacted', 'Hot, not contacted', '14', '−4 vs last week', 'good', [22, 20, 19, 18, 17, 15, 14], { info: DEF.hot, note: 'Assign today' }),
    kpi('meetings', 'Meetings booked', '22', '+5 vs last week', 'good', [2, 3, 4, 3, 5, 2, 3], { info: DEF.meetings, bar: true, note: '14 completed' }),
    kpi('conversions', 'Conversions', '8', '+2 vs last week', 'good', [0, 1, 1, 2, 1, 1, 2], { info: DEF.conversions, note: 'Opportunities' }),
  ],
  actionItems: [
    { title: 'Campaign strategy', badge: ['Approval', 'info'], detail: 'AI proposes “Auto Mfg Q4 push”: email, then voice, 3 follow-ups', action: 'Review', href: '/voice-campaigns', primary: true },
    { title: 'Conversion approval', badge: ['Approval', 'info'], detail: 'Acme Motors · Qualified → Opportunity (Anita R.)', action: 'Review', href: '/conversion', primary: true },
    { title: 'Conversion approval', badge: ['Approval', 'info'], detail: 'Nexa Motors · Qualified → Opportunity (Dev S.)', action: 'Review', href: '/conversion' },
    { title: 'Follow-up far past deadline', badge: ['Overdue', 'bad'], detail: 'Kiran Autos · 1 day late (Meera K.)', action: 'Review', href: '/operations/callbacks' },
  ],
  leaderboard: [
    { rep: 'Anita R.', contacted: 92, avgResponse: '1h 50m', meetings: 8, conversions: 3 },
    { rep: 'Dev S.', contacted: 81, avgResponse: '2h 20m', meetings: 6, conversions: 2 },
    { rep: 'Meera K.', contacted: 74, avgResponse: '3h 40m', meetings: 5, conversions: 2 },
    { rep: 'Raj P.', contacted: 65, avgResponse: '5h 10m', meetings: 3, conversions: 1 },
  ],
  workload: [
    { rep: 'Anita R.', hot: 6, warm: 14, other: 22, overdue: 0 }, { rep: 'Dev S.', hot: 4, warm: 12, other: 19, overdue: 0 },
    { rep: 'Meera K.', hot: 3, warm: 9, other: 31, overdue: 5 }, { rep: 'Raj P.', hot: 1, warm: 5, other: 38, overdue: 4 },
  ],
  coaching: [
    { title: 'Raj P.', detail: 'Slowest replies: 5h 10m average (team 3h 05m)', badge: ['Slow replies', 'bad'] },
    { title: 'Meera K.', detail: 'Low meeting-to-opportunity rate: 25%', badge: ['Low conversion', 'warn'] },
    { title: 'Raj P.', detail: '3 high-score leads never contacted', badge: ['Missed leads', 'bad'] },
  ],
  funnel: [TEAM_FUNNEL[1], TEAM_FUNNEL[2], TEAM_FUNNEL[3], TEAM_FUNNEL[4], TEAM_FUNNEL[6]],
  campaigns: [
    { name: 'Auto Mfg – India', channels: 'Email → Voice', status: ['Active', 'good'], contacted: 142, meetings: 9, conversions: 3 },
    { name: 'SaaS Mid-Market', channels: 'Voice → Email', status: ['Active', 'good'], contacted: 118, meetings: 7, conversions: 3 },
    { name: 'Webinar Follow-up', channels: 'Email → SMS', status: ['Paused', 'neutral'], contacted: 52, meetings: 6, conversions: 2 },
    { name: 'Pilot Re-engage', channels: 'Voice', status: ['Pending approval', 'warn'], contacted: 0, meetings: 0, conversions: 0 },
  ],

  reportKpis: [
    kpi('response', 'Avg response time', '3h 05m', 'Lower is better', 'warn', null, { info: DEF.response }),
    unavailable('responseSla', 'Response SLA', UNAVAILABLE_REASON.sla, DEF.responseSla),
    unavailable('followUpSla', 'Follow-up SLA', UNAVAILABLE_REASON.sla, DEF.followUpSla),
    kpi('overdue', 'Overdue items', '21', 'Open now', 'bad', null, { info: DEF.overdue }),
    kpi('showRate', 'Show rate', '73%', 'Completed ÷ booked', 'good', null, { info: DEF.showRate }),
    kpi('lost', 'No-shows & cancellations', '10', '27% of booked', 'bad', null, { info: DEF.lost }),
    kpi('meetingToOpp', 'Meeting → opportunity', '45%', 'Opportunities ÷ completed', 'good', null, { info: DEF.meetingToOpp }),
    kpi('conversionRate', 'Overall conversion', '2.7%', 'Opportunities ÷ prospects', 'good', null, { info: DEF.conversionRate }),
  ],
  responseByRep: [{ rep: 'Anita R.', hours: 1.8 }, { rep: 'Dev S.', hours: 2.3 }, { rep: 'Meera K.', hours: 3.7 }, { rep: 'Raj P.', hours: 5.2 }],
  reportFunnel: TEAM_FUNNEL,
  repConversion: [{ rep: 'Anita R.', rate: 6.8 }, { rep: 'Dev S.', rate: 4.9 }, { rep: 'Meera K.', rate: 3.8 }, { rep: 'Raj P.', rate: 2.1 }],
  scoreBands: SCORE_BANDS,
  missedLeads: [
    { rep: 'Anita R.', neverContacted: 1, contactedLate: 1 }, { rep: 'Dev S.', neverContacted: 2, contactedLate: 2 },
    { rep: 'Meera K.', neverContacted: 3, contactedLate: 2 }, { rep: 'Raj P.', neverContacted: 5, contactedLate: 3 },
  ],
  campaignPerformance: [
    { campaign: 'Auto Mfg – India', meetings: 9, conversions: 3 }, { campaign: 'SaaS Mid-Market', meetings: 7, conversions: 3 },
    { campaign: 'Webinar Follow-up', meetings: 6, conversions: 2 },
  ],
  channelPerformance: [
    { channel: 'Call', responses: 160, meetings: 14, conversions: 5 }, { channel: 'Email', responses: 150, meetings: 11, conversions: 4 },
    { channel: 'SMS', responses: 40, meetings: 5, conversions: 1 },
  ],
  repActivity: [
    { rep: 'Anita R.', calls: 60, emails: 90, sms: 20 }, { rep: 'Dev S.', calls: 55, emails: 70, sms: 15 },
    { rep: 'Meera K.', calls: 48, emails: 64, sms: 10 }, { rep: 'Raj P.', calls: 30, emails: 52, sms: 8 },
  ],
  repMeetingOutcomes: [
    { rep: 'Anita R.', completed: 7, rescheduled: 1, cancelled: 0, noShow: 1 }, { rep: 'Dev S.', completed: 5, rescheduled: 1, cancelled: 1, noShow: 1 },
    { rep: 'Meera K.', completed: 4, rescheduled: 1, cancelled: 1, noShow: 2 }, { rep: 'Raj P.', completed: 2, rescheduled: 0, cancelled: 1, noShow: 2 },
  ],
  repPerformance: REPS.map((r, i) => ({
    rep: r, contacted: [92, 81, 74, 65][i], avgResponse: ['1h 50m', '2h 20m', '3h 40m', '5h 10m'][i],
    meetings: [8, 6, 5, 3][i], conversions: [3, 2, 2, 1][i], workload: [42, 35, 43, 44][i],
  })),
};

const tenant = {
  kpis: [
    kpi('activeUsers', 'Active users', '38 / 45', '+3 this month', 'good', [30, 32, 33, 35, 36, 37, 38], { info: DEF.activeUsers, note: '84% of seats' }),
    kpi('contacted', 'Prospects contacted', '1,248', '+12% vs last week', 'good', [700, 800, 860, 950, 1050, 1160, 1248], { info: DEF.contacted }),
    kpi('conversions', 'Conversions', '31', '+6 vs last week', 'good', [12, 15, 18, 21, 24, 28, 31], { info: DEF.conversions }),
    unavailable('aiCost', 'AI cost', UNAVAILABLE_REASON.aiCost, DEF.aiCost),
    kpi('aiFailure', 'AI failure rate', '1.8%', '−0.4 pts', 'good', [2.6, 2.4, 2.3, 2.1, 2, 1.9, 1.8], { info: DEF.aiFailure, unit: '%', note: '2,914 requests' }),
    kpi('integrationFailures', 'Integration failures', '7', '+2 vs yesterday', 'bad', [2, 3, 3, 4, 5, 5, 7], { info: DEF.integrationFailures, note: '3 dead-lettered' }),
  ],
  funnel: [TEAM_FUNNEL[1], TEAM_FUNNEL[2], TEAM_FUNNEL[3], TEAM_FUNNEL[4], TEAM_FUNNEL[6]],
  integrationHealth: [
    { title: 'Voice calls', detail: 'Last sync 2 min ago · 0 failures in 24h', badge: ['Connected', 'good'] },
    { title: 'Calendar sync', detail: 'Last sync 5 min ago · 1 failure', badge: ['Connected', 'good'] },
    { title: 'Prospect data provider', detail: 'Rate-limited · 3 imports queued', badge: ['Degraded', 'warn'] },
    { title: 'Outbound events', detail: '3 dead-lettered · 3 retrying', badge: ['Failing', 'bad'] },
  ],
  modelHealth: [
    { title: 'Scoring coverage', detail: '91% of prospects have a current score', badge: ['Healthy', 'good'] },
    { title: 'Stale scores', detail: '37 prospects out of date', badge: ['Watch', 'warn'] },
    { title: 'Response time', detail: 'p95 1.8 s', badge: ['Healthy', 'good'] },
    { title: 'Failure rate', detail: '1.8% of requests failed', badge: ['Healthy', 'good'] },
  ],
  compliance: [
    { title: 'Blocked by consent or do-not-contact', detail: '40 prospects', badge: ['Enforced', 'good'] },
    { title: 'No consent record', detail: '120 prospects', badge: ['Review', 'warn'] },
    { title: 'Contact attempts stopped', detail: '38 this week', badge: ['Working', 'good'] },
  ],
  aiFeatures: [
    { name: 'Lead scoring', enabled: true }, { name: 'Intent assessment', enabled: true }, { name: 'Scheduling', enabled: true },
    { name: 'AI filtering', enabled: true }, { name: 'AI insights', enabled: false },
  ],
  auditActivity: AUDIT,

  reportKpis: [
    kpi('conversionRate', 'Overall conversion', '2.7%', 'Opportunities ÷ prospects', 'good', null, { info: DEF.conversionRate }),
    unavailable('responseSla', 'Response SLA', UNAVAILABLE_REASON.sla, DEF.responseSla),
    unavailable('aiCost', 'Total AI cost', UNAVAILABLE_REASON.aiCost, DEF.aiCost),
    unavailable('costPerMeeting', 'AI cost per meeting', UNAVAILABLE_REASON.aiCost, DEF.costPerMeeting),
    kpi('coverage', 'Scoring coverage', '91%', 'Scored ÷ all prospects', 'good', null, { info: DEF.coverage }),
    kpi('stale', 'Stale scores', '37', 'Out of date', 'warn', null, { info: DEF.stale }),
    unavailable('adoption', 'Feature adoption rate', UNAVAILABLE_REASON.adoption, DEF.adoption),
    kpi('integrationRate', 'Integration failure rate', '1.2%', 'Failed ÷ all events', 'good', null, { info: DEF.integrationRate }),
    kpi('integrationFailures', 'Unresolved failures', '7', '+2 vs yesterday', 'bad', null, { info: DEF.integrationFailures }),
  ],
  reportFunnel: TEAM_FUNNEL,
  teamPerformance: [{ team: 'Team North', rate: 6.1, meetings: 14 }, { team: 'Team South', rate: 4.4, meetings: 11 }, { team: 'Enterprise', rate: 2.6, meetings: 7 }],
  scoringCalibration: [{ band: '80+', predicted: 35, actual: 31 }, { band: '60–79', predicted: 15, actual: 14 }, { band: 'Below 60', predicted: 5, actual: 4 }],
  scoreFreshness: [[610, 60, 70], [640, 50, 62], [650, 45, 58], [690, 40, 50], [720, 38, 42], [730, 37, 35]]
    .map(([fresh, stale, notScored], i) => ({ week: WEEKS[i], fresh, stale, notScored })),
  integrationFailures: byDay([[1, 0, 2, 0], [0, 1, 2, 1], [1, 0, 3, 2], [0, 1, 2, 2], [1, 0, 3, 3], [0, 0, 2, 3], [0, 1, 3, 3]], ['voice', 'calendar', 'prospectData', 'outboundEvents']),
  failureLog: [
    { service: 'Outbound events', error: 'Timeout from CRM', retries: 5, state: ['Dead-lettered', 'bad'] },
    { service: 'Prospect data', error: 'Rate limit', retries: 2, state: ['Retrying', 'warn'] },
    { service: 'Calendar', error: 'Token expired', retries: 1, state: ['Resolved', 'good'] },
  ],
  consentStatus: [{ status: 'Consented', count: 820 }, { status: 'No consent record', count: 120 }, { status: 'Opted out', count: 64 }, { status: 'Do-not-contact', count: 40 }],
  auditLog: AUDIT,
};

export const MOCK = { rep, manager, tenant };

/** The scope the backend would apply to this user. Only the mock uses it. */
export const scopeOf = (role) => (role === 'rep' ? 'rep' : role === 'manager' ? 'manager' : 'tenant');
