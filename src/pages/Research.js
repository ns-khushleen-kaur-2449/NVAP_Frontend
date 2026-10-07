import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Search, Sparkles, TrendingUp, AlertTriangle, Users, Building2 } from 'lucide-react';
import { getResearchReports, runResearch } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { AgentButton } from '@/components/shared/AgentButton';

export default function ResearchPage() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getResearchReports().then(r => { setReports(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await runResearch();
      toast.success('Research report generated');
      setReports(prev => [r.data, ...prev]);
      setSelected(r.data);
    } catch (e) {
      toast.error('Research failed: ' + (e.response?.data?.detail || e.message));
    }
    setRunning(false);
  };

  const impactColors = {
    high: 'bg-[hsla(0,72%,52%,0.16)] text-[hsl(0,72%,70%)]',
    medium: 'bg-[hsla(38,92%,50%,0.16)] text-[hsl(38,92%,65%)]',
    low: 'bg-[hsla(173,80%,36%,0.18)] text-[hsl(173,80%,55%)]',
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">AI-powered market intelligence, investor discovery, and property matching</p>
        <AgentButton onClick={handleRun} loading={running} icon={Search} data-testid="run-research-button">
          Run Research Agent
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
                  {loading ? 'Loading...' : 'No reports yet. Run the research agent.'}
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

              {/* Investors */}
              {selected.investors?.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Discovered Investors ({selected.investors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))]">
                          <TableHead className="text-xs">Investor</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Budget</TableHead>
                          <TableHead className="text-xs">Interests</TableHead>
                          <TableHead className="text-xs text-right">Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.investors.map((inv, i) => (
                          <TableRow key={i} className="hover:bg-[hsl(var(--surface-2))]">
                            <TableCell className="text-sm font-medium">{inv.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs border-0 bg-[hsl(var(--surface-2))]">{inv.type}</Badge></TableCell>
                            <TableCell className="text-sm">{inv.budget_range}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{inv.interest_areas?.join(', ')}</TableCell>
                            <TableCell className="text-right">
                              <span className="tabular-nums text-sm" style={{ color: inv.confidence >= 70 ? 'hsl(173,80%,36%)' : inv.confidence >= 40 ? 'hsl(38,55%,62%)' : 'hsl(0,72%,52%)' }}>
                                {inv.confidence}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Property Matches */}
              {selected.property_matches?.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[hsl(38,55%,62%)]" /> Property Matches ({selected.property_matches.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selected.property_matches.map((match, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-[hsl(var(--surface-2))]">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{match.property_name}</p>
                            <p className="text-xs text-muted-foreground">Matched with: {match.lead_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-display text-lg tabular-nums" style={{ color: match.match_score >= 70 ? 'hsl(173,80%,36%)' : 'hsl(38,55%,62%)' }}>
                              {match.match_score}%
                            </span>
                            <p className="text-[10px] text-muted-foreground">Match Score</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Market Alerts */}
              {selected.market_alerts?.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[hsl(38,92%,50%)]" /> Market Alerts ({selected.market_alerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selected.market_alerts.map((alert, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border bg-[hsl(var(--surface-2))]">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[10px] border-0 ${impactColors[alert.impact] || impactColors.medium}`}>
                            {alert.impact}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-0 bg-[hsl(var(--surface-3))]">{alert.type}</Badge>
                          <span className="text-sm font-medium">{alert.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {selected.recommendations?.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" /> Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {selected.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-card border-border h-full flex items-center justify-center" style={{ minHeight: 400 }}>
              <div className="text-center">
                <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Run the research agent or select a report</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
