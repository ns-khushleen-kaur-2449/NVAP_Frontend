import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { SkeletonRows } from '@/components/ops/States';
import { FormError, HiringError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { getHiringJob, replaceHiringQuestions } from '@/lib/api';
import { MAX_INTAKE_QUESTIONS, checkQuestions } from '@/lib/hiring';

/**
 * A job's intake questions, in the order the call asks them. With `canEdit` the whole set is edited and saved at
 * once (1 to 8); otherwise it is read only. Calls already placed keep the questions they were asked.
 */
export default function QuestionsDialog({ job, canEdit, onOpenChange, onSaved }) {
  const [texts, setTexts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!job) return;
    setTexts(null);
    setLoadError(null);
    setError(null);
    try {
      const { data } = await getHiringJob(job.id);
      const questions = (data.questions || []).map((question) => question.question_text);
      setTexts(questions.length || !canEdit ? questions : ['']);
    } catch (e) {
      setLoadError(e);
    }
  }, [job, canEdit]);

  useEffect(() => { load(); }, [load]);

  const change = (index, value) => setTexts((list) => list.map((text, i) => (i === index ? value : text)));
  const remove = (index) => setTexts((list) => list.filter((_, i) => i !== index));
  const move = (index, delta) => setTexts((list) => {
    const next = [...list];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    return next;
  });

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const { questions, error: problem } = checkQuestions(texts);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await replaceHiringQuestions(job.id, questions);
      toast.success('Questions saved');
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setError(errorMessage(e, 'The questions could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const iconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card '
    + 'hover:bg-[hsl(var(--surface-2))] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Dialog open={Boolean(job)} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-2xl max-h-[90vh] overflow-y-auto rounded-[14px]">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{canEdit ? 'Edit questions' : 'Questions'}: {job?.title}</DialogTitle>
            <DialogDescription>
              The intake call asks these in order. Calls already placed keep the questions they were asked.
            </DialogDescription>
          </DialogHeader>

          {loadError ? <HiringError error={loadError} onRetry={load} />
            : texts === null ? <SkeletonRows rows={3} label="Loading questions" />
            : !canEdit ? (
              texts.length ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm" data-testid="questions-read-only">
                  {texts.map((text, i) => <li key={i}>{text}</li>)}
                </ol>
              ) : <p className="text-sm text-muted-foreground">No questions yet.</p>
            ) : (
              <div className="space-y-3">
                {texts.map((text, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="ops-num mt-2 w-5 text-right text-sm text-muted-foreground">{i + 1}.</span>
                    <textarea value={text} onChange={(e) => change(i, e.target.value)} rows={2} maxLength={2000}
                      aria-label={`Question ${i + 1}`}
                      className="min-h-[2.5rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <div className="flex gap-1">
                      <button type="button" className={iconButton} onClick={() => move(i, -1)} disabled={i === 0}
                        aria-label={`Move question ${i + 1} up`}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" className={iconButton} onClick={() => move(i, 1)}
                        disabled={i === texts.length - 1} aria-label={`Move question ${i + 1} down`}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" className={iconButton} onClick={() => remove(i)}
                        disabled={texts.length === 1} aria-label={`Remove question ${i + 1}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <OpsButton size="sm" onClick={() => setTexts((list) => [...list, ''])}
                    disabled={texts.length >= MAX_INTAKE_QUESTIONS}>
                    <Plus className="h-4 w-4" /> Add question
                  </OpsButton>
                  <span className="text-xs text-muted-foreground">{texts.length} of {MAX_INTAKE_QUESTIONS}</span>
                </div>
              </div>
            )}

          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
              {canEdit ? 'Cancel' : 'Close'}
            </OpsButton>
            {canEdit && texts !== null && !loadError && (
              <OpsButton type="submit" variant="primary" busy={busy}>Save questions</OpsButton>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
