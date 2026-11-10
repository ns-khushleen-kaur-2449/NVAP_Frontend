import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import CallRecording from '@/components/hiring/CallRecording';
import CallTranscript from '@/components/hiring/CallTranscript';
import {
  CALL_STATUS, QUESTION_RESULT, callOutcome, callProblem, interviewResult, resultProblem, statusOf,
} from '@/lib/hiring';

/** The call's questions: each one's result once the summary is read, otherwise the questions it was placed with. */
function CallQuestions({ call }) {
  if (call.questions?.length) {
    return (
      <section aria-label="Answers" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Answers</h4>
        <ol className="space-y-2">
          {call.questions.map((question, index) => {
            const state = statusOf(QUESTION_RESULT, question.status);
            return (
              <li key={question.question_id} className="rounded-lg border border-border p-2.5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{index + 1}. {question.question_text}</p>
                  <StatusBadge label={state.label} tone={state.tone} />
                </div>
                {question.answer && <p className="mt-1 text-muted-foreground">{question.answer}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
  if (!call.snapshot?.length) return null;
  return (
    <section aria-label="Questions on this call" className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions on this call</h4>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {call.snapshot.map((question) => <li key={question.question_id}>{question.question_text}</li>)}
      </ol>
    </section>
  );
}

/** One call attempt: what happened, the interview result, its questions, and its transcript and recording. */
export default function CallCard({ bookingId, call, number }) {
  const status = statusOf(CALL_STATUS, call.status);
  const outcome = callOutcome(call);
  const result = interviewResult(call);
  const problem = callProblem(call);
  const reviewReason = resultProblem(call);
  const review = reviewReason ? `Needs review: ${reviewReason}` : null; // one string: one text node
  const title = `Call ${number}`;

  return (
    <article aria-label={title} data-testid={`call-${call.id}`}
      className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge label={status.label} tone={status.tone} />
          {outcome && <StatusBadge label={outcome.label} tone={outcome.tone} />}
          {result && <StatusBadge label={result.label} tone={result.tone} />}
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Started</dt><dd><RelativeTime iso={call.dialed_at || call.created_at} /></dd></div>
        <div><dt className="text-muted-foreground">Ended</dt><dd><RelativeTime iso={call.ended_at} /></dd></div>
      </dl>
      {problem && <p className="text-sm text-[color:var(--ops-warn)]">{problem}</p>}
      {review && <p className="text-sm text-[color:var(--ops-warn)]">{review}</p>}
      <CallQuestions call={call} />
      {(call.has_transcript || call.has_recording) && (
        <div className="space-y-2">
          {call.has_transcript && <CallTranscript bookingId={bookingId} callId={call.id} />}
          {call.has_recording && <CallRecording bookingId={bookingId} callId={call.id} />}
        </div>
      )}
    </article>
  );
}
