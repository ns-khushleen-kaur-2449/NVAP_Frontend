import { useState } from 'react';
import OpsButton from '@/components/ops/OpsButton';
import { errorMessage } from '@/hooks/useApiAction';
import { getHiringCallTranscript } from '@/lib/api';
import { isForbidden, isNotFound } from '@/lib/hiring';

/** The failed load as `{ text, retry }`: a refusal (403) is not worth retrying. */
function failure(error) {
  if (isNotFound(error)) return { text: 'No transcript for this call yet.', retry: true };
  if (isForbidden(error)) return { text: errorMessage(error, 'You cannot read this transcript.'), retry: false };
  return { text: 'The transcript could not be loaded.', retry: true };
}

/**
 * A call's transcript and summary, loaded only when asked for. Only those two fields are shown: the backend never
 * sends Vapi's raw messages, and anything else in the answer is ignored.
 */
export default function CallTranscript({ bookingId, callId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getHiringCallTranscript(bookingId, callId);
      setText({ transcript: data.transcript || '', summary: data.summary || null });
    } catch (e) {
      setError(failure(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !text && !loading) load();
  };

  return (
    <div className="space-y-2">
      <OpsButton size="sm" onClick={toggle} aria-expanded={open}>{open ? 'Hide transcript' : 'Show transcript'}</OpsButton>
      {open && (
        <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3 text-sm">
          {loading && <p className="text-muted-foreground">Loading the transcript…</p>}
          {error && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="alert">{error.text}</p>
              {error.retry && <OpsButton size="sm" variant="quiet" onClick={load}>Try again</OpsButton>}
            </div>
          )}
          {text && (
            <>
              {text.summary && (
                <section aria-label="Summary">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h4>
                  <p className="mt-1">{text.summary}</p>
                </section>
              )}
              <section aria-label="Transcript">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</h4>
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap font-sans">{text.transcript}</pre>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
