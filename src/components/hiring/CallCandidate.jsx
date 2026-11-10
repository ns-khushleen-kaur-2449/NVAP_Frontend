import { useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import { startHiringCall } from '@/lib/api';
import {
  MAX_CALL_ATTEMPTS, callBlocker, callRefusal, callStarted, callsUsed, newKey,
} from '@/lib/hiring';

/**
 * "Call candidate" (hiring.call: Tenant Admins and Managers). Each click gets its own idempotency key. The key is
 * kept only when no answer came back (network lost), so pressing again retries that same click and the backend never
 * dials twice; any answer from the backend ends the click, and the next press is a new call. While a request runs the
 * button is off, so a double click sends one request.
 */
export default function CallCandidate({ booking, calls, onDone }) {
  const unanswered = useRef(null);
  // Set before the first await: a second click that lands before React re-renders still sees it.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const blocker = callBlocker(booking, calls);
  // One string, so it renders as one text node.
  const usage = `Calls used: ${callsUsed(calls)} of ${MAX_CALL_ATTEMPTS}. Calls that were not placed do not count.`;
  const label = busy ? 'Calling…' : 'Call candidate';

  const place = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const key = unanswered.current || newKey();
    unanswered.current = key;
    setBusy(true);
    setProblem(null);
    try {
      const response = await startHiringCall(booking.id, key);
      unanswered.current = null;
      const { kind, text } = callStarted(response.status, booking.candidate_name);
      toast[kind](text);
    } catch (error) {
      if (error?.response) {
        unanswered.current = null;
        setProblem(callRefusal(error));
      } else {
        setProblem({ message: 'The call request got no answer.', hint: 'Press Call candidate again: it will not call twice.' });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
      onDone?.();
    }
  };

  return (
    <section aria-label="Call" className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Intake call</h3>
          <p className="text-xs text-muted-foreground">{usage}</p>
        </div>
        <OpsButton variant="primary" onClick={place} busy={busy} disabled={Boolean(blocker)}>
          <Phone className="h-4 w-4" /> {label}
        </OpsButton>
      </div>
      {blocker && <p className="text-sm text-muted-foreground">{blocker}</p>}
      {problem && (
        <div role="alert" className="text-sm text-[color:var(--ops-bad)]">
          <p>{problem.message}</p>
          {problem.hint && <p className="text-muted-foreground">{problem.hint}</p>}
        </div>
      )}
    </section>
  );
}
