import { useEffect, useState } from 'react';
import {
  Table2, Upload, RefreshCw, CheckCircle2, AlertCircle,
  ExternalLink, Download, FileText, FileSpreadsheet, FileType2,
  Sheet, Clock, Zap, BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAnalysisReports, pushToSheet, getSheetsUrl } from '@/lib/api';
import { toast } from 'sonner';

export default function GoogleSheetsSyncPage() {
  const [audioId, setAudioId]       = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [sheetsUrl, setSheetsUrl]   = useState(null);

  // Derived totals from history
  const totalPushed = syncHistory.reduce((s, h) => s + h.ok,   0);
  const totalFailed = syncHistory.reduce((s, h) => s + h.fail, 0);
  const lastSync    = syncHistory[0]?.ts ?? null;

  useEffect(() => {
    getSheetsUrl()
      .then(({ data }) => setSheetsUrl(data.url))
      .catch(() => {});
  }, []);

  /* ── helpers ─────────────────────────────────────────── */
  const spreadsheetId = sheetsUrl?.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
  const exportUrl     = (fmt) =>
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=${fmt}`;

  const exportFormats = [
    { fmt: 'pdf',  label: 'PDF',   icon: FileText,        ext: '.pdf'  },
    { fmt: 'xlsx', label: 'Excel', icon: FileSpreadsheet, ext: '.xlsx' },
    { fmt: 'csv',  label: 'CSV',   icon: FileType2,       ext: '.csv'  },
  ];

  /* ── actions ─────────────────────────────────────────── */
  const handlePushAll = async () => {
    setPushLoading(true);
    try {
      const { data } = await getAnalysisReports();
      const list      = Array.isArray(data) ? data : data.analyses || [];
      const completed = list.filter((c) => c.audio_id && (c.status === 'completed' || c.overall_score != null));
      if (completed.length === 0) { toast.info('No completed analyses to push'); return; }

      let ok = 0, fail = 0;
      for (const item of completed) {
        try { await pushToSheet(item.audio_id); ok++; } catch { fail++; }
      }
      setSyncHistory((h) => [{ ts: new Date().toLocaleString(), ok, fail }, ...h.slice(0, 9)]);
      toast.success(`Pushed ${ok} records${fail ? ` (${fail} failed)` : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setPushLoading(false);
    }
  };

  const handlePushSingle = async () => {
    if (!audioId.trim()) { toast.error('Enter an Audio ID'); return; }
    setPushLoading(true);
    try {
      await pushToSheet(audioId.trim());
      setSyncHistory((h) => [
        { ts: new Date().toLocaleString(), ok: 1, fail: 0, id: audioId },
        ...h.slice(0, 9),
      ]);
      toast.success('Pushed to Google Sheets');
      setAudioId('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Push failed');
    } finally {
      setPushLoading(false);
    }
  };

  /* ── render ──────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-1">

      {/* ── Page header ────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Sheet className="w-6 h-6 text-emerald-400" />
            Google Sheets Sync
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Push scored call analyses to Google Sheets — per-call details in Sheet 1, weekly summaries in Sheet 2.
          </p>
        </div>
        {sheetsUrl && (
          <a href={sheetsUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="shrink-0">
              <ExternalLink className="w-4 h-4 mr-2" /> Open Google Sheet
            </Button>
          </a>
        )}
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Zap,       label: 'Total Pushed',  value: totalPushed, color: 'text-emerald-400' },
          { icon: AlertCircle, label: 'Total Failed', value: totalFailed, color: 'text-red-400'     },
          { icon: Clock,     label: 'Last Sync',     value: lastSync ?? '—', color: 'text-muted-foreground', small: true },
        ].map(({ icon: Icon, label, value, color, small }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-2 rounded-lg bg-muted/40">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`font-semibold ${small ? 'text-xs mt-0.5' : 'text-xl'} ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Two-column action area ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bulk push */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-400" /> Bulk Push
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Push <strong>all</strong> completed analyses at once. Existing rows are updated; new rows are appended automatically.
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end gap-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground space-y-1">
              <BarChart3 className="w-6 h-6 mx-auto opacity-40" />
              <p>Syncs <span className="font-semibold text-foreground">all</span> records with <code className="bg-muted px-1 rounded">status = completed</code></p>
            </div>
            <Button onClick={handlePushAll} disabled={pushLoading} className="w-full">
              {pushLoading
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Pushing…</>
                : <><Upload className="w-4 h-4 mr-2" /> Push All Completed</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Single push */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Table2 className="w-4 h-4 text-violet-400" /> Push Single Recording
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Target a specific call analysis by its Audio ID to push or re-push a single record.
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="audio-id" className="text-xs">Audio ID</Label>
              <Input
                id="audio-id"
                placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                value={audioId}
                onChange={(e) => setAudioId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePushSingle()}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Paste the UUID from the Audio Upload page</p>
            </div>
            <Button
              onClick={handlePushSingle}
              disabled={pushLoading || !audioId.trim()}
              variant="secondary"
              className="w-full"
            >
              {pushLoading
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Pushing…</>
                : <><Table2 className="w-4 h-4 mr-2" /> Push Recording</>
              }
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Export section ─────────────────────────────── */}
      {spreadsheetId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-400" /> Export Sheet
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Download the linked spreadsheet in your preferred format
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {exportFormats.map(({ fmt, label, icon: Icon, ext }) => (
                <a key={fmt} href={exportUrl(fmt)} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" className="w-full flex-col h-auto py-4 gap-1.5 hover:border-amber-400/40 hover:bg-amber-400/5 transition-colors">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{ext}</span>
                  </Button>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sync history ───────────────────────────────── */}
      {syncHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent Syncs
              <span className="ml-auto text-xs font-normal text-muted-foreground">Last 10 operations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide bg-muted/20">
                  <th className="px-4 py-2.5 text-left">#</th>
                  <th className="px-4 py-2.5 text-left">Timestamp</th>
                  <th className="px-4 py-2.5 text-left">Audio ID</th>
                  <th className="px-4 py-2.5 text-center">Pushed</th>
                  <th className="px-4 py-2.5 text-center">Failed</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((h, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{syncHistory.length - i}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{h.ts}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {h.id ? (
                        <span className="bg-muted/40 px-1.5 py-0.5 rounded text-[10px]">
                          {h.id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="italic opacity-50">all</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-400/10 text-emerald-400 font-semibold text-xs">
                        {h.ok}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-semibold text-xs ${
                        h.fail > 0
                          ? 'bg-red-400/10 text-red-400'
                          : 'bg-muted/30 text-muted-foreground'
                      }`}>
                        {h.fail}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {h.fail === 0
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        : <AlertCircle  className="w-4 h-4 text-amber-400 mx-auto"   />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}