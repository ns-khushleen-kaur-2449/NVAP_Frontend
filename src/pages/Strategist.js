import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Send, Rocket, Users, Mail, Briefcase, Phone, MessageSquare, Target, Lightbulb, Anchor, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { strategistChat, launchCampaignFromStrategy } from '@/lib/api';
import { strategistStore } from '@/lib/strategistStore';

const CHANNEL_META = {
  email: { icon: Mail, emoji: '📧', label: 'Email' },
  linkedin: { icon: Briefcase, emoji: '💼', label: 'LinkedIn' },
  phone: { icon: Phone, emoji: '📞', label: 'Phone call' },
  sms: { icon: MessageSquare, emoji: '💬', label: 'SMS' },
};

function channelMeta(channel) {
  return CHANNEL_META[(channel || '').toLowerCase()] || { icon: MessageSquare, emoji: '✉️', label: channel || 'Touchpoint' };
}

function StrategyCard({ strategy, onLaunch, launching, prospectCount }) {
  return (
    <Card className="card-base mt-3 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display font-semibold text-base">
          <span aria-hidden>🚀</span> {strategy.name}
        </div>
        <Button size="sm" onClick={() => onLaunch(strategy)} disabled={launching || !prospectCount} className="bg-primary text-primary-foreground shrink-0">
          <Rocket className="w-3.5 h-3.5 mr-1" /> {launching ? 'Launching…' : 'One-click launch'}
        </Button>
      </div>
      {!prospectCount && (
        <p className="text-xs text-amber-600">⚠️ Select prospects in Prospecting → My Leads first, then come back to launch.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="text-sm rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <Target className="w-3.5 h-3.5" /> Target audience
          </div>
          <div className="leading-relaxed break-words whitespace-pre-wrap">{strategy.icp?.description || '—'}</div>
        </div>
        <div className="text-sm rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> Messaging angle
          </div>
          <div className="leading-relaxed break-words whitespace-pre-wrap">{strategy.messaging_angle || '—'}</div>
        </div>
      </div>

      {strategy.hook && (
        <div className="text-sm rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <Anchor className="w-3.5 h-3.5" /> Opening hook
          </div>
          <div className="leading-relaxed break-words whitespace-pre-wrap italic">"{strategy.hook}"</div>
        </div>
      )}

      {strategy.sequence?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <CalendarClock className="w-3.5 h-3.5" /> Sequence ({strategy.sequence.length} steps)
          </div>
          <ol className="relative space-y-3 border-l-2 border-border ml-2 pl-4">
            {strategy.sequence.map((s, i) => {
              const meta = channelMeta(s.channel);
              const Icon = meta.icon;
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[22px] top-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background" aria-hidden />
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="secondary" className="font-mono">Day {s.day}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      <Icon className="w-3.5 h-3.5 text-primary" /> {meta.emoji} {meta.label}
                    </span>
                    {s.goal && <span className="text-xs text-muted-foreground italic">— {s.goal}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">{s.description}</p>
                  {s.talking_points?.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {s.talking_points.map((tp, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5" aria-hidden>•</span> <span className="break-words">{tp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}

export default function StrategistPage() {
  // Seeded from the module-level store so chat survives in-app navigation (route
  // changes) but resets on a real browser refresh — see lib/strategistStore.js.
  const [msgs, setMsgs] = useState(() => strategistStore.msgs);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const endRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Arriving via Prospecting's "Build Campaign" sets location.state, which only lives
  // for that one navigation entry — any later navigation within the app (e.g. clicking
  // a different nav link and coming back) wipes it back to undefined even though the
  // chat history is still on screen. Latch the selection into strategistStore too, the
  // same persistence pattern already used for msgs, so the launch button doesn't
  // silently disable itself just because the user looked at another page in between.
  const incomingProspectIds = location.state?.prospectIds;
  const [prospectIds, setProspectIds] = useState(() => incomingProspectIds || strategistStore.prospectIds);
  const prospectCount = prospectIds.length;

  useEffect(() => {
    if (incomingProspectIds) {
      strategistStore.prospectIds = incomingProspectIds;
      setProspectIds(incomingProspectIds);
    }
  }, [incomingProspectIds]);

  useEffect(() => { strategistStore.msgs = msgs; }, [msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text) => {
    const message = text || input;
    if (!message.trim() || busy) return;
    setInput('');
    setMsgs((m) => [...m, { id: Date.now(), role: 'user', content: message }]);
    setBusy(true);
    try {
      const { data } = await strategistChat(message);
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'assistant', content: data.reply, strategy: data.strategy }]);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Strategist request failed');
    }
    setBusy(false);
  };

  const launch = async (strategy) => {
    if (prospectIds.length === 0) {
      toast.error('Select prospects in Prospecting → My Leads first');
      return;
    }
    setLaunching(true);
    try {
      const { data } = await launchCampaignFromStrategy(strategy, prospectIds);
      toast.success(`Campaign "${data.campaign.name}" launched with ${data.matched_count} real prospects`);
      navigate(`/campaigns/${data.campaign.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Launch failed');
    }
    setLaunching(false);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] max-w-4xl mx-auto flex flex-col">
      <div className="sticky top-14 z-30 bg-background pb-4 border-b border-border">
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> AI Strategist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Describe your goal in plain English. Get a launch-ready campaign.</p>
        {prospectCount > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-[hsl(var(--surface-2))] px-3 py-1.5 rounded-full">
            <Users className="w-3.5 h-3.5 text-primary" /> {prospectCount} prospects selected from My Leads
          </div>
        )}
      </div>

      <div className="flex-1 py-6 space-y-4">
        {msgs.length === 0 && !busy && (
          <div className="max-w-lg mx-auto text-center pt-16">
            <Sparkles className="w-7 h-7 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Try: "I want to book demos with VPs of Engineering at mid-size fintech companies"</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => send('I want to book demos with VPs of Engineering at mid-size fintech companies. Build me a campaign.')}>
              Use this example
            </Button>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-2xl animate-in fade-in slide-in-from-bottom-1 duration-300 ${m.role === 'user' ? 'ml-auto' : ''}`}>
            {m.role === 'assistant' && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1 ml-1">
                <Sparkles className="w-3 h-3 text-primary" /> Strategist
              </div>
            )}
            <div className={`text-sm leading-relaxed px-4 py-3 rounded-lg inline-block whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
              {m.content}
            </div>
            {m.strategy && <StrategyCard strategy={m.strategy} onLaunch={launch} launching={launching} prospectCount={prospectIds.length} />}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse ml-1">
            <Sparkles className="w-3 h-3 text-primary" /> Strategist is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 z-30 bg-background py-4 border-t border-border flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Describe your GTM goal…" className="flex-1" />
        <Button onClick={() => send()} disabled={busy} className="bg-primary text-primary-foreground"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
