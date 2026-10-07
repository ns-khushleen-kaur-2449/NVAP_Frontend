import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, Upload, Globe, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  getKbs, createKb, deleteKb, setActiveKb,
  getKbFiles, uploadKbFile, deleteKbFile, scrapeKbUrl,
} from '@/lib/api';

export default function KnowledgeBasePage() {
  const [kbs, setKbs] = useState([]);
  const [activeKb, setActiveKbState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newKbName, setNewKbName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyKb, setBusyKb] = useState(null); // kb name currently uploading/scraping
  const [scrapeUrlByKb, setScrapeUrlByKb] = useState({});

  const loadKbs = async () => {
    setLoading(true);
    try {
      const { data } = await getKbs();
      const withFiles = await Promise.all(
        (data.kbs || []).map(async (kb) => {
          try {
            const filesRes = await getKbFiles(kb.name);
            return { ...kb, files: filesRes.data?.files || [] };
          } catch {
            return { ...kb, files: [] };
          }
        })
      );
      setKbs(withFiles);
      setActiveKbState(data.active_kb || null);
    } catch (e) {
      toast.error('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKbs(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newKbName.trim();
    if (!name) return;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) {
      toast.error('Name must start with a letter and contain only letters, numbers, or underscores.');
      return;
    }
    setCreating(true);
    try {
      await createKb(name);
      toast.success(`Knowledge base "${name}" created`);
      setNewKbName('');
      await loadKbs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create knowledge base');
    } finally {
      setCreating(false);
    }
  };

  const handleSetActive = async (name) => {
    try {
      await setActiveKb(name);
      toast.success(`"${name}" is now the active knowledge base`);
      await loadKbs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to set active knowledge base');
    }
  };

  const handleDeleteKb = async (name) => {
    if (!window.confirm(`Delete knowledge base "${name}"? This permanently removes all its content.`)) return;
    try {
      await deleteKb(name);
      toast.success(`"${name}" deleted`);
      await loadKbs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete knowledge base');
    }
  };

  const handleUpload = async (kbName, fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setBusyKb(kbName);
    try {
      for (const file of files) {
        try {
          await uploadKbFile(kbName, file);
        } catch (e) {
          toast.error(`Failed to upload ${file.name}: ${e.response?.data?.detail || 'Error'}`);
        }
      }
      toast.success('Files uploaded');
    } finally {
      setBusyKb(null);
      await loadKbs();
    }
  };

  const handleScrape = async (kbName) => {
    const url = (scrapeUrlByKb[kbName] || '').trim();
    if (!url) return;
    setBusyKb(kbName);
    try {
      const { data } = await scrapeKbUrl(url, kbName);
      toast.success(`Scraped "${data.title || url}"`);
      setScrapeUrlByKb((prev) => ({ ...prev, [kbName]: '' }));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to scrape URL');
    } finally {
      setBusyKb(null);
      await loadKbs();
    }
  };

  const handleDeleteFile = async (kbName, sourceFile) => {
    if (!window.confirm(`Remove "${sourceFile}" from "${kbName}"?`)) return;
    try {
      await deleteKbFile(kbName, sourceFile);
      toast.success('File removed');
      await loadKbs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove file');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto mt-8 px-4 pb-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center justify-center gap-2">
          <Bot className="h-7 w-7" /> Knowledge Base
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
          Create and manage the knowledge bases the AI chatbot draws its answers from. Upload documents or scrape a web page to add content.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New knowledge base</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              placeholder="Name (letters, numbers, underscores)"
              maxLength={64}
              disabled={creating}
            />
            <Button type="submit" disabled={creating || !newKbName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading knowledge bases...</div>
      ) : kbs.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No knowledge bases yet. Create one above.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kbs.map((kb) => {
            const isActive = kb.name === activeKb;
            const isBusy = busyKb === kb.name;
            return (
              <Card key={kb.name} className={isActive ? 'border-primary' : ''}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {kb.name}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kb.files.length} file{kb.files.length === 1 ? '' : 's'} · {kb.chunk_count ?? 0} chunk{kb.chunk_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteKb(kb.name)} title="Delete knowledge base">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border-y border-border py-2">
                    {kb.files.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No files yet</p>
                    ) : (
                      kb.files.map((f) => {
                        const isUrl = f.source_file?.startsWith('http://') || f.source_file?.startsWith('https://');
                        return (
                          <div key={f.source_file} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {isUrl ? <Globe className="h-3.5 w-3.5 flex-shrink-0 text-teal-500" /> : <FileText className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
                              <span className="text-xs truncate" title={f.source_file}>{f.source_file}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{f.chunk_count} chunks</span>
                              <button onClick={() => handleDeleteFile(kb.name, f.source_file)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={isActive ? 'secondary' : 'outline'} disabled={isActive} onClick={() => handleSetActive(kb.name)}>
                      {isActive ? 'In use' : 'Use for chat'}
                    </Button>
                    <label className={isBusy ? 'pointer-events-none opacity-50' : ''}>
                      <input
                        type="file"
                        multiple
                        accept=".txt,.md,.csv,.html,.htm,.pdf,.docx,.json"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(e) => handleUpload(kb.name, e.target.files)}
                      />
                      <Button size="sm" variant="outline" asChild>
                        <span className="cursor-pointer">
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Add files
                        </span>
                      </Button>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="https://... to scrape"
                      value={scrapeUrlByKb[kb.name] || ''}
                      onChange={(e) => setScrapeUrlByKb((prev) => ({ ...prev, [kb.name]: e.target.value }))}
                      disabled={isBusy}
                      className="text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => handleScrape(kb.name)} disabled={isBusy || !(scrapeUrlByKb[kb.name] || '').trim()}>
                      <Globe className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
