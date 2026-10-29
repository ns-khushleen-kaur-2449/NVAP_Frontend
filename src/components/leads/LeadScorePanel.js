import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { RefreshCw, HelpCircle, Check, X } from 'lucide-react';
import { getLeadScore, getLeadScoreHistory, calculateLeadScore } from '@/lib/api';
import { ScoreGauge } from '@/components/shared/ScoreGauge';

// Temperature comes from the backend (HOT / WARM / COLD by default, bands set by the methodology).
const TEMPERATURE_COLOR = {
  HOT: 'hsl(0, 72%, 52%)',
  WARM: 'hsl(38, 80%, 58%)',
  COLD: 'hsl(210, 70%, 60%)',
};
const FALLBACK_COLOR = 'hsl(215, 15%, 60%)';

const GROUP_LABEL = { fit: 'Fit', engagement: 'Engagement' };
const CHANNEL_LABEL = { call: 'Call', sms: 'SMS', email: 'Email' };
const RESTRICTION_LABEL = {
  stage_disqualified: 'Stage is Disqualified',
  stage_do_not_contact: 'Stage is Do Not Contact',
  intent_disqualified: 'Disqualified by intent assessment',
  on_do_not_call_list: 'On the do-not-call list',
  no_call_consent: 'No call consent',
  no_sms_consent: 'No SMS consent',
  no_email_consent: 'No email consent',
};

const label = (s) => String(s ?? '').replace(/_/g, ' ');

// FastAPI errors: a string, or {message, missing_features} for 422.
const errorText = (e, fallback) => {
  const detail = e.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const missing = detail.missing_features?.length ? ` Missing: ${detail.missing_features.map(label).join(', ')}.` : '';
    return `${detail.message || fallback}${missing}`;
  }
  return fallback;
};

const factorValue = (f) => {
  if (f.status === 'missing') return f.note || 'No data';
  if (f.status === 'malformed') return 'Invalid value';
  return f.matched != null ? String(f.matched) : '';
};

const GroupRow = ({ name, points, group }) => {
  const weight = group?.weight;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{GROUP_LABEL[name] || label(name)}</span>
        <span className="tabular-nums text-muted-foreground">{points ?? 0}{weight != null ? ` / ${weight}` : ''} pts</span>
      </div>
      <Progress value={weight ? Math.min(100, ((points ?? 0) / weight) * 100) : 0} className="h-1.5" />
      {group?.below_min_coverage && (
        <p className="text-[10px] text-muted-foreground mt-0.5">Too little data ({Math.round(group.coverage * 100)}% known) — unknown factors count as 0.</p>
      )}
    </div>
  );
};

// One card: the lead's quick info (children), its current Fit + Engagement score and why.
const LeadScorePanel = ({ prospectId, onScored, children }) => {
  const [score, setScore] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setScore(null);
    setEvents([]);
    setMessage('');
    try {
      const r = await getLeadScore(prospectId);
      setScore(r.data);
      try {
        const h = await getLeadScoreHistory(prospectId, { page: 1, page_size: 5 });
        setEvents(h.data.items || []);
      } catch { /* the breakdown is optional */ }
    } catch (e) {
      if (e.response?.status !== 404) setMessage(errorText(e, 'Could not load the lead score.'));
    }
    setLoading(false);
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  const calculate = async () => {
    setCalculating(true);
    try {
      const r = await calculateLeadScore(prospectId);
      setScore(r.data.current_score);
      setMessage('');
      onScored?.(r.data.current_score);
      if (r.data.is_current === false) toast.info('A newer score already exists; showing it.');
      else toast.success('Lead score updated');
      // History is newest first; reload it so the breakdown and trend match the new score.
      const h = await getLeadScoreHistory(prospectId, { page: 1, page_size: 5 }).catch(() => null);
      setEvents(h?.data.items || [r.data.calculation]);
    } catch (e) {
      toast.error(errorText(e, 'Could not calculate a score for this lead.'));
    }
    setCalculating(false);
  };

  // The breakdown belongs to the newest scoring event; a seeded score has none.
  const explanation = events[0]?.explanation || null;
  const factors = explanation?.factors || [];
  const groupPoints = explanation?.group_points || {};
  const quality = explanation?.data_quality;
  const eligibility = score?.eligibility;
  const temperature = score?.temperature;
  const color = TEMPERATURE_COLOR[temperature] || FALLBACK_COLOR;
  const seeded = score && !score.scoring_method;
  const rounded = score ? Math.round(score.lead_score) : null;

  return (
    <section className="mb-5 w-full min-w-0 break-words rounded-xl border border-border bg-[hsl(var(--surface-2))] p-4" aria-label="Lead score">
      {children && <div className="mb-4 border-b border-border pb-4">{children}</div>}

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Lead Score</h4>
        <Button variant="outline" size="sm" onClick={calculate} disabled={calculating || loading} data-testid="calculate-score">
          <RefreshCw className={`w-3 h-3 mr-1 ${calculating ? 'animate-spin' : ''}`} />
          {score ? 'Recalculate' : 'Calculate score'}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading score...</p>
      ) : !score ? (
        <p className="text-xs text-muted-foreground">{message || 'This lead has not been scored yet.'}</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ScoreGauge score={rounded} size={100} color={color} label={temperature || 'Score'} />
            <div className="flex-1 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {temperature && (
                  <span className="rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ color, borderColor: color }}>
                    {temperature}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">out of 100</span>
              </div>
              {score.intent_level && <div><span className="text-muted-foreground">Intent:</span> <span className="capitalize">{label(score.intent_level)}</span></div>}
              {score.recommended_action && <div><span className="text-muted-foreground">Next action:</span> <span className="capitalize">{label(score.recommended_action)}</span></div>}
              <div className="text-xs text-muted-foreground">Scored {new Date(score.calculated_at).toLocaleString()}</div>
            </div>
          </div>

          {seeded && (
            <p className="mt-3 text-xs text-muted-foreground">
              This is a demo score with no breakdown. Recalculate to score it from the lead's data.
            </p>
          )}

          {Object.keys(groupPoints).length > 0 && (
            <div className="mt-4 space-y-2">
              {Object.entries(groupPoints).map(([name, points]) => (
                <GroupRow key={name} name={name} points={points} group={explanation.groups?.[name]} />
              ))}
            </div>
          )}

          {factors.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Why This Score</p>
              <ul className="space-y-1.5">
                {factors.map((f) => {
                  const known = f.status !== 'missing' && f.status !== 'malformed';
                  return (
                    <li key={f.feature} className="flex items-start justify-between gap-3 text-xs">
                      <span className="min-w-0">
                        <span className="capitalize">{label(f.feature)}</span>
                        <span className="block text-muted-foreground break-words">
                          {factorValue(f)}
                          {f.freshness?.multiplier != null && f.freshness.multiplier < 1 && ` · aged ×${f.freshness.multiplier}`}
                          {f.excluded && ' · left out of the score'}
                        </span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${known ? '' : 'text-muted-foreground'}`}>
                        {f.contribution == null ? '—' : `${f.contribution} pts`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {quality && (
            <p className="mt-3 text-xs text-muted-foreground">
              Contact data: email {quality.has_email ? 'on file' : 'missing'}{quality.verified_email ? ' (verified)' : ''}, phone {quality.has_phone ? 'on file' : 'missing'}. Not scored.
            </p>
          )}

          {eligibility && (
            <div className="mt-4 border-t border-border pt-3">
              <p className={`text-xs font-medium ${eligibility.eligible_for_outreach ? '' : 'text-[hsl(38,92%,65%)]'}`}>
                {eligibility.eligible_for_outreach ? 'Eligible for outreach' : 'Not eligible for outreach'}
              </p>
              {eligibility.channels && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {Object.entries(eligibility.channels).map(([channel, allowed]) => (
                    <span key={channel} className="inline-flex items-center gap-1">
                      {allowed ? <Check className="w-3 h-3 text-[hsl(173,80%,36%)]" /> : <X className="w-3 h-3 text-[hsl(0,72%,52%)]" />}
                      {CHANNEL_LABEL[channel] || label(channel)}
                    </span>
                  ))}
                </div>
              )}
              {eligibility.restrictions?.length > 0 && (
                <ul className="mt-1.5 text-xs text-[hsl(38,92%,65%)] space-y-0.5">
                  {eligibility.restrictions.map((r) => <li key={r}>{RESTRICTION_LABEL[r] || label(r)}</li>)}
                </ul>
              )}
            </div>
          )}

          {events.length > 1 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-1.5">Recent scores</p>
              <ul className="space-y-1 text-xs">
                {events.map((ev) => (
                  <li key={ev.score_history_id} className="flex justify-between text-muted-foreground">
                    <span>{new Date(ev.calculated_at).toLocaleDateString()}</span>
                    <span className="tabular-nums">{Math.round(ev.lead_score)}{ev.temperature ? ` · ${ev.temperature}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default LeadScorePanel;
