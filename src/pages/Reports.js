import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { BarChart3, Sparkles, TrendingUp, AlertTriangle, Users, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, FunnelChart, Funnel, LabelList } from 'recharts';
import { getExecReports, runExecReport } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { AgentButton } from '@/components/shared/AgentButton';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExecReports().then(r => { setReports(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await runExecReport();
      toast.success('Executive report generated');
      setReports(prev => [r.data, ...prev]);
      setSelected(r.data);
    } catch (e) {
      toast.error('Report generation failed: ' + (e.response?.data?.detail || e.message));
    }
    setRunning(false);
  };

  const ratingColors = {
    excellent: 'bg-[hsla(158,64%,42%,0.18)] text-[hsl(158,64%,55%)]',
    good: 'bg-[hsla(173,80%,36%,0.18)] text-[hsl(173,80%,55%)]',
    needs_improvement: 'bg-[hsla(38,92%,50%,0.16)] text-[hsl(38,92%,65%)]',
  };

  const funnelData = selected?.conversion_funnel ? Object.entries(selected.conversion_funnel)
    .filter(([k]) => !['closed_lost'].includes(k))
    .map(([name, value]) => ({
      name: name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value
    })) : [];

  const funnelColors = ['hsl(199,70%,45%)', 'hsl(215,60%,50%)', 'hsl(173,80%,36%)', 'hsl(38,55%,62%)', 'hsl(280,60%,50%)', 'hsl(158,64%,42%)'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">AI-powered performance coaching, peer matching, and conversion intelligence</p>
        <AgentButton onClick={handleRun} loading={running} icon={BarChart3} data-testid="run-exec-report-button">
          Generate Report
        </AgentButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* Reports List */}
        <Card className="xl:col-span-3 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Reports ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[550px]">
              {reports.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {loading ? 'Loading...' : 'No reports yet. Generate one.'}
                </div>
              ) : reports.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`p-3 cursor-pointer border-b border-border hover:bg-[hsl(var(--surface-2))] transition-colors ${selected?.id === r.id ? 'bg-[hsl(var(--surface-2))]' : ''}`}
                >
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{formatDateTime(r.created_at)}</p>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Report Detail */}
        <div className="xl:col-span-9 space-y-4">
          {selected ? (
            <>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg">{selected.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selected.summary}</p>
                </CardHeader>
              </Card>

              {/* Scorecards + Funnel */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Scorecards */}
                {selected.scorecards?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" /> Executive Scorecards
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
                            <TableHead className="text-xs">Executive</TableHead>
                            <TableHead className="text-xs text-right">Leads</TableHead>
                            <TableHead className="text-xs text-right">Conv %</TableHead>
                            <TableHead className="text-xs">Rating</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.scorecards.map((sc, i) => (
                            <TableRow key={i} className="hover:bg-[hsl(var(--surface-2))]">
                              <TableCell className="text-sm font-medium">{sc.exec_name}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{sc.leads_handled}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{(sc.conversion_rate * 100).toFixed(0) || sc.conversion_rate}%</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] border-0 ${ratingColors[sc.rating] || ratingColors.good}`}>
                                  {sc.rating?.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Conversion Funnel */}
                {funnelData.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[hsl(38,55%,62%)]" /> Conversion Funnel
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215,20%,70%)' }} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'hsl(215,20%,70%)' }} />
                            <Tooltip contentStyle={{ background: 'hsl(222,40%,10%)', border: '1px solid hsl(222,22%,18%)', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {funnelData.map((_, i) => <Cell key={i} fill={funnelColors[i % funnelColors.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Peer Matches */}
              {selected.peer_matches?.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Target className="w-4 h-4 text-[hsl(199,70%,45%)]" /> Peer Match Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selected.peer_matches.map((pm, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border bg-[hsl(var(--surface-2))]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{pm.underperformer}</span>
                          <span className="text-xs text-muted-foreground">paired with</span>
                          <span className="text-sm font-medium text-primary">{pm.mentor}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Gap: {pm.skill_gap}</p>
                        <p className="text-xs text-primary mt-1">{pm.recommendation}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Coaching + Risks */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {selected.coaching_insights?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Coaching Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selected.coaching_insights.map((ins, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            {ins}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selected.deal_risks?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[hsl(0,72%,52%)]" /> Deal Risks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selected.deal_risks.map((risk, i) => (
                        <div key={i} className="p-2 rounded-lg border border-border bg-[hsl(var(--surface-2))]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{risk.lead_name}</span>
                            <Badge variant="outline" className={`text-[10px] border-0 ${
                              risk.risk_level === 'high' ? 'bg-[hsla(0,72%,52%,0.16)] text-[hsl(0,72%,70%)]' :
                              risk.risk_level === 'medium' ? 'bg-[hsla(38,92%,50%,0.16)] text-[hsl(38,92%,65%)]' :
                              'bg-[hsla(173,80%,36%,0.18)] text-[hsl(173,80%,55%)]'
                            }`}>{risk.risk_level}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{risk.reason}</p>
                          <p className="text-xs text-primary mt-1">{risk.suggested_action}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <Card className="bg-card border-border h-full flex items-center justify-center" style={{ minHeight: 400 }}>
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Generate or select an executive report</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
