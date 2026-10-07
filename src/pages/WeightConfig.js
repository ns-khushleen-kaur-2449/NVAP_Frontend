import { useEffect, useState } from 'react';
import { Sliders, RotateCcw, Save, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getWeightConfig, updateWeightConfig, resetWeightConfig } from '@/lib/api';
import { toast } from 'sonner';

const PARAMS = [
  {
    key: 'introduction_weight',
    label: 'Introduction',
    description: "How well the agent opens the call — clear greeting, self-introduction, and an engaging opening that holds the prospect's attention.",
  },
  {
    key: 'probing_weight',
    label: 'Probing',
    description: "Quality of discovery questions asked to understand the prospect's needs, budget, and timeline.",
  },
  {
    key: 'adherence_weight',
    label: 'Script Adherence',
    description: 'How accurately the agent follows the script and demonstrates knowledge of the property/product without factual errors.',
  },
  {
    key: 'listening_weight',
    label: 'Active Listening',
    description: 'How well the agent picks up on what the prospect says and responds relevantly instead of pushing a fixed script.',
  },
  {
    key: 'fumble_weight',
    label: 'Fumble (lower = better)',
    description: 'Measures hesitations, incorrect information, awkward silences, or recoveries — a high fumble score hurts the overall rating.',
  },
  {
    key: 'closing_weight',
    label: 'Call Closing',
    description: 'How confidently the agent ends the call — securing a next step (visit, callback) rather than leaving it open-ended.',
  },
  {
    key: 'objection_weight',
    label: 'Objection Handling',
    description: 'How calmly and effectively the agent addresses price concerns, doubts, or pushback without losing the prospect.',
  },
  {
    key: 'value_proposition_weight',
    label: 'Site Visit Persuasion',
    description: "How effectively the agent persuades the prospect to commit to a site visit — creating genuine urgency and a clear next step.",
  },
];

const DEFAULT_WEIGHTS = {
  introduction_weight: 13, probing_weight: 13, adherence_weight: 13,
  listening_weight: 13, fumble_weight: 12, closing_weight: 12,
  objection_weight: 12, value_proposition_weight: 12,
};

export default function WeightConfigPage() {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const total = Object.values(weights).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const isValid = total === 100;

  useEffect(() => {
    getWeightConfig()
      .then(({ data }) => {
        const w = {};
        PARAMS.forEach(({ key }) => { if (data[key] != null) w[key] = data[key]; });
        setWeights((prev) => ({ ...prev, ...w }));
      })
      .catch(() => toast.error('Failed to load weight config'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, val) => {
    setWeights((prev) => ({ ...prev, [key]: Math.min(100, Math.max(0, Math.round(val))) }));
  };

  const handleInputChange = (key, raw) => {
    if (raw === '') {
      setWeights((prev) => ({ ...prev, [key]: '' }));
      return;
    }
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      setWeights((prev) => ({ ...prev, [key]: Math.min(100, Math.max(0, num)) }));
    }
  };

  const handleInputBlur = (key, raw) => {
    const num = parseInt(raw, 10);
    setWeights((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }));
  };

  const handleSave = async () => {
    if (!isValid) { toast.error(`Weights must sum to 100. Current: ${total}`); return; }
    setSaving(true);
    try {
      await updateWeightConfig(weights);
      toast.success('Weight configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const { data } = await resetWeightConfig();
      const w = {};
      PARAMS.forEach(({ key }) => { if (data[key] != null) w[key] = data[key]; });
      setWeights(w);
      toast.success('Weights reset to defaults');
    } catch {
      toast.error('Reset failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto mt-8 px-4">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Scoring Weight Configuration</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
          Configure how each diagnostic parameter scales to calculate the final QA score. Total weight allocation must sum up to 100%.
        </p>
      </div>

      <Card className="border border-border bg-card shadow-soft rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/40 py-5 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2 font-semibold text-slate-900">
              <Sliders className="w-5 h-5 text-[#F87217]" /> Parameter Weights
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold tabular-nums px-3 py-1 rounded-full ${
                isValid 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                Allocation: {total}% / 100%
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0 bg-card">
          {PARAMS.map(({ key, label, description }) => (
            <div 
              key={key} 
              className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 p-6 items-center transition-colors duration-150 hover:bg-slate-50/50"
            >
              {/* Left Column: Title & Description */}
              <div className="md:col-span-6 space-y-1">
                <h3 className="font-semibold text-sm text-slate-900">{label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                  {description}
                </p>
              </div>

              {/* Right Column: Slider Controls */}
              <div className="md:col-span-6 flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[parseInt(weights[key], 10) || 0]}
                    onValueChange={([v]) => handleChange(key, v)}
                    className="cursor-pointer"
                  />
                </div>
                <div className="w-20 shrink-0 relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[key]}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    onBlur={(e) => handleInputBlur(key, e.target.value)}
                    className="font-mono font-semibold text-sm bg-[#F87217]/5 border border-[#F87217]/25 text-[#F87217] rounded px-2 py-1 w-full text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F87217]/30 focus:border-[#F87217]/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#F87217]/60 text-xs font-semibold pointer-events-none">%</span>
                </div>
              </div>
            </div>
          ))}

          <div className="p-6 space-y-6">
            {!isValid && (
              <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <span>
                  The allocated weights sum to <strong>{total}%</strong>. Please adjust the parameters until they total exactly 100% to save.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={saving || !isValid}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#F87217] hover:bg-[#253164] text-white font-semibold shadow-sm transition-all"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving…' : 'Save Configuration'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleReset} 
                disabled={saving}
                className="w-full sm:w-auto px-6"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Reset to Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
