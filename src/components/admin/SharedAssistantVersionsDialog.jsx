import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { errorText } from '@/components/admin/userBits';
import {
  checkAgentAssistantVersion, createAgentAssistantDraft, importAgentAssistantVersion, listAgentAssistantVersions,
  publishAgentAssistantVersion, rollbackAgentAssistantVersion,
} from '@/lib/api';
import { VERSION_STATUS_LABELS, parseAssistantJson } from '@/lib/agents';

const STATUS_STYLE = {
  published: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  superseded: 'text-muted-foreground',
};

const pretty = (payload) => JSON.stringify(payload, null, 2);
// The live version's JSON, to start editing from; empty when nothing is live.
const liveText = (list) => {
  const live = list.find((v) => v.status === 'published');
  return live ? pretty(live.payload) : '';
};

/**
 * Super Admin: a shared assistant's versions (backend `features/agents/assistant_versions.py`).
 * Import only reads Vapi; publishing and restoring change the assistant in Vapi for every organisation using the agent,
 * so both ask first. The backend runs the staged check again on every publish.
 */
export default function SharedAssistantVersionsDialog({ agent, assistant, onClose }) {
  const open = Boolean(agent && assistant);
  const [versions, setVersions] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // The last check: { version, ok, problems }; version is null when a publish was refused.
  const [check, setCheck] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = (await listAgentAssistantVersions(agent.id, assistant.id)).data;
      setVersions(list);
      return list;
    } catch (e) {
      setError(errorText(e, 'Could not load versions'));
      setVersions([]);
      return [];
    }
  }, [agent, assistant]);

  useEffect(() => {
    if (!open) return;
    setVersions(null);
    setError(null);
    setCheck(null);
    setText('');
    load().then((list) => setText(liveText(list)));
  }, [open, load]);

  const run = async (work, fallback) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail && Array.isArray(detail.problems)) {
        setError(detail.message);
        setCheck({ version: null, ok: false, problems: detail.problems });
      } else {
        setError(errorText(e, fallback));
      }
    } finally {
      setBusy(false);
    }
  };

  const importFromVapi = () => run(async () => {
    await importAgentAssistantVersion(agent.id, assistant.id);
    toast.success('Version 1 imported from Vapi');
    setText(liveText(await load()));
  }, 'Could not import from Vapi');

  const saveDraft = () => {
    const parsed = parseAssistantJson(text);
    if (parsed.error) { setError(parsed.error); return; }
    run(async () => {
      const saved = (await createAgentAssistantDraft(agent.id, assistant.id, parsed.payload)).data;
      toast.success(`Saved as draft version ${saved.version}`);
      setCheck(null);
      await load();
    }, 'Could not save the draft');
  };

  const runCheck = (version) => run(async () => {
    const result = (await checkAgentAssistantVersion(agent.id, assistant.id, version.version)).data;
    setCheck({ version: version.version, ...result });
  }, 'Could not run the check');

  const confirm = () => {
    const { action, version } = confirming;
    setConfirming(null);
    run(async () => {
      if (action === 'publish') {
        await publishAgentAssistantVersion(agent.id, assistant.id, version.version);
        toast.success(`Version ${version.version} is live`);
      } else {
        const restored = (await rollbackAgentAssistantVersion(agent.id, assistant.id, version.version)).data;
        toast.success(`Version ${version.version} restored as version ${restored.version}`);
      }
      setCheck(null);
      await load();
    }, action === 'publish' ? 'Could not publish' : 'Could not restore');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto" data-testid="assistant-versions-dialog">
        <DialogHeader>
          <DialogTitle>Versions of {assistant?.name}</DialogTitle>
          <DialogDescription>
            Publishing changes this assistant in Vapi for every organisation using {agent?.name}. Its webhook settings stay as
            they are in Vapi.
          </DialogDescription>
        </DialogHeader>

        {!versions ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
        ) : versions.length === 0 ? (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              No versions yet. Import version 1 from Vapi to start; this only reads the assistant, nothing in Vapi changes.
            </p>
            <Button onClick={importFromVapi} disabled={busy} className="bg-primary text-primary-foreground">
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Import from Vapi
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Saved</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id} data-testid={`version-row-${version.version}`}>
                    <TableCell className="text-sm font-medium">
                      {version.version}
                      {version.copied_from && <span className="text-xs text-muted-foreground"> (copy of {version.copied_from})</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] ${STATUS_STYLE[version.status] || ''}`}>
                        {VERSION_STATUS_LABELS[version.status] || version.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => { setText(pretty(version.payload)); setCheck(null); }}>View</Button>
                      {version.status === 'draft' && (
                        <>
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => runCheck(version)}>Check</Button>
                          <Button size="sm" disabled={busy} onClick={() => setConfirming({ action: 'publish', version })}>Publish</Button>
                        </>
                      )}
                      {version.status === 'superseded' && (
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => setConfirming({ action: 'rollback', version })}>Restore</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {check && (
          <div className="rounded-lg border border-border p-3 text-sm" data-testid="version-check">
            {check.ok ? (
              <p className="text-emerald-600">Version {check.version} passed the check and can be published.</p>
            ) : (
              <>
                <p className="font-medium">
                  {check.version ? `Version ${check.version} can't be published yet:` : 'Not published:'}
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {check.problems.map((problem) => <li key={problem}>{problem}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {versions?.length > 0 && (
          <label className="block text-xs font-medium text-muted-foreground">Assistant JSON (Vapi format)
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} spellCheck={false}
              className="mt-1 font-mono text-xs" />
          </label>
        )}
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        {versions?.length > 0 && (
          <DialogFooter>
            <Button onClick={saveDraft} disabled={busy} className="bg-primary text-primary-foreground">
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save as draft
            </Button>
          </DialogFooter>
        )}

        <AlertDialog open={Boolean(confirming)} onOpenChange={(isOpen) => !isOpen && setConfirming(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirming?.action === 'publish' ? `Publish version ${confirming?.version.version}?` : `Restore version ${confirming?.version.version}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                This changes the assistant in Vapi for every organisation using {agent?.name}.
                {confirming?.action === 'rollback' && ' It is copied into a new version and published.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirm}>{confirming?.action === 'publish' ? 'Publish' : 'Restore'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
