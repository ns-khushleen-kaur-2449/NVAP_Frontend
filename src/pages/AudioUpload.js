import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileAudio, Mic, RefreshCw, ChevronRight, Sliders, RotateCcw, Info, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { uploadAudioFile, diarizeAudio, analyzeCall, getWeightConfig, updateWeightConfig } from '@/lib/api';
import { toast } from 'sonner';

const WEIGHT_KEYS = [
  { key: 'introduction_weight',        label: 'Introduction/Hook' },
  { key: 'adherence_weight',           label: 'Adherence to script/Product Knowledge' },
  { key: 'listening_weight',           label: 'Actively listening/ Responding Appropriately' },
  { key: 'fumble_weight',              label: 'Fumble' },
  { key: 'probing_weight',             label: 'Probing' },
  { key: 'closing_weight',             label: 'Closing' },
  { key: 'objection_weight',           label: 'Objection Handling' },
  { key: 'value_proposition_weight',   label: 'Site Visit Persuasion' },
];

const DEFAULT_WEIGHTS = Object.fromEntries(WEIGHT_KEYS.map(({ key }) => [key, 12.5]));

const STATUS_COLORS = {
  uploaded:  'bg-blue-500/15 text-blue-600',
  diarized:  'bg-amber-500/15 text-amber-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  failed:    'bg-red-500/15 text-red-600',
};

function WeightEditor({ weights, onChange, onReset, defaultWeights }) {
  const total = Object.values(weights).reduce((s, v) => s + Number(v), 0);
  const isDefault = WEIGHT_KEYS.every(({ key }) => Number(weights[key]) === Number(defaultWeights[key]));
  const isValid = Math.abs(total - 100) <= 0.01;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Scoring Weights</span>
          {isDefault && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">Using defaults</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-semibold ${isValid ? 'text-emerald-600' : 'text-red-500'}`}>
            Total: {Math.round(total * 10) / 10}/100
          </span>
          {!isDefault && (
            <button onClick={onReset} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
        {WEIGHT_KEYS.map(({ key, label }) => (
          <div key={key}>
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-[10px] text-muted-foreground truncate pr-1">{label}</label>
              <span className="text-[10px] font-semibold tabular-nums">{weights[key]}</span>
            </div>
            <input
              type="range" min={0} max={50} step={1}
              value={weights[key]}
              onChange={(e) => onChange(key, Number(e.target.value))}
              className="w-full h-1.5 accent-[#F87217] cursor-pointer"
            />
          </div>
        ))}
      </div>

      {!isValid && (
        <p className="text-[11px] text-red-500">Weights must sum to 100 before analysing.</p>
      )}
    </div>
  );
}

export default function AudioUploadPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [executiveName, setExecutiveName] = useState('');
  const [processing, setProcessing] = useState({});
  const [defaultWeights, setDefaultWeights] = useState(DEFAULT_WEIGHTS);
  const [uploadWeights, setUploadWeights] = useState({});

  useEffect(() => {
    getWeightConfig()
      .then(({ data }) => {
        const w = Object.fromEntries(WEIGHT_KEYS.map(({ key }) => [key, data[key] ?? 10]));
        setDefaultWeights(w);
      })
      .catch(() => {});
  }, []);

  const getWeights = (audioId) => uploadWeights[audioId] || { ...defaultWeights };

  const setWeight = (audioId, key, value) => {
    setUploadWeights((prev) => ({
      ...prev,
      [audioId]: { ...getWeights(audioId), [key]: value },
    }));
  };

  const resetWeights = (audioId) => {
    setUploadWeights((prev) => { const n = { ...prev }; delete n[audioId]; return n; });
  };

  const handleFile = async (file) => {
    if (!file) return;
    const toastId = toast.loading(`Uploading ${file.name}…`);
    try {
      const { data } = await uploadAudioFile(file, executiveName.trim() || undefined);
      setUploads((prev) => [
        { id: data.audio_id, name: data.original_filename, type: data.file_type, step: 'uploaded' },
        ...prev,
      ]);
      toast.success('Uploaded. Click "Diarize" to process.', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: toastId });
    }
  };

  const handleDiarize = async (audioId) => {
    setProcessing((p) => ({ ...p, [audioId]: 'diarizing' }));
    try {
      await diarizeAudio(audioId);
      setUploads((prev) => prev.map((u) => u.id === audioId ? { ...u, step: 'diarized' } : u));
      toast.success('Diarization complete. Set weights and analyse.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Diarization failed');
    } finally {
      setProcessing((p) => ({ ...p, [audioId]: null }));
    }
  };

  const handleAnalyse = async (audioId) => {
    const weights = getWeights(audioId);
    const total = Object.values(weights).reduce((s, v) => s + Number(v), 0);
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Weights must sum to 100 (current: ${Math.round(total * 10) / 10})`);
      return;
    }

    setProcessing((p) => ({ ...p, [audioId]: 'analysing' }));
    try {
      const isModified = WEIGHT_KEYS.some(({ key }) => Number(weights[key]) !== Number(defaultWeights[key]));
      if (isModified) {
        await updateWeightConfig(weights);
      }
      await analyzeCall(audioId);
      setUploads((prev) => prev.map((u) => u.id === audioId ? { ...u, step: 'completed' } : u));
      toast.success('Analysis complete. View in Call Quality Dashboard.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setProcessing((p) => ({ ...p, [audioId]: null }));
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto mt-8">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Audio Upload</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Upload call recordings for diarization and LLM quality analysis.
        </p>
      </div>

      {/* Temporary notice */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
        <Info className="w-4 h-4 shrink-0 text-amber-500" />
        <p className="text-xs">
          <span className="font-semibold">Temporary:</span> In production, recordings will be fetched automatically from <span className="font-semibold">Zoho CRM</span>.
        </p>
      </div>

      {/* Executive name */}
      <div className="max-w-sm mx-auto">
        <label className="text-xs text-muted-foreground mb-2 block text-center">Executive name <span className="text-muted-foreground/60">(optional)</span></label>
        <Input
          className="text-center bg-white"
          placeholder="e.g. Executive 1"
          value={executiveName}
          onChange={(e) => setExecutiveName(e.target.value)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors
          ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-[hsl(var(--surface-2))]'}`}
      >
        <Upload className="w-10 h-10 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">Drop audio file here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Supports .mp3, .wav, .m4a, .opus, .gsm</p>
        </div>
        <input
          ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.opus,.gsm,audio/x-gsm,audio/gsm"
          className="hidden" onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* Queue */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileAudio className="w-4 h-4" /> Processing Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {uploads.map((u) => {
              const weights = getWeights(u.id);
              const total = Object.values(weights).reduce((s, v) => s + Number(v), 0);
              const weightsValid = Math.abs(total - 100) <= 0.01;

              return (
                <div key={u.id} className="px-4 py-3">
                  {/* Row */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{u.type}</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[u.step] || 'bg-muted text-muted-foreground'}`}>
                      {u.step}
                    </span>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {u.step === 'uploaded' && (
                        <Button size="sm" variant="outline" onClick={() => handleDiarize(u.id)} disabled={!!processing[u.id]}>
                          {processing[u.id] === 'diarizing'
                            ? <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                            : <Mic className="w-3 h-3 mr-1" />}
                          Diarize
                        </Button>
                      )}
                      {u.step === 'diarized' && (
                        <Button size="sm" onClick={() => handleAnalyse(u.id)}
                          disabled={!!processing[u.id] || !weightsValid}>
                          {processing[u.id] === 'analysing'
                            ? <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                            : <ChevronRight className="w-3 h-3 mr-1" />}
                          Analyse
                        </Button>
                      )}
                      {u.step === 'completed' && (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-0">Done</Badge>
                          <Button
                            size="sm"
                            className="bg-[#F87217] hover:bg-[#252f60] text-white gap-1.5"
                            onClick={() => navigate('/call-quality')}
                          >
                            <BarChart2 className="w-3 h-3" />
                            Call Quality
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline weight editor — only for diarized */}
                  {u.step === 'diarized' && (
                    <WeightEditor
                      weights={weights}
                      defaultWeights={defaultWeights}
                      onChange={(key, val) => setWeight(u.id, key, val)}
                      onReset={() => resetWeights(u.id)}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

    </div>
  );
}