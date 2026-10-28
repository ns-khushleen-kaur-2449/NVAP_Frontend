import React from 'react';
import { Lock } from 'lucide-react';
import { splitProtected } from '../../../lib/builderPersonalization';

function OpenerCard({ title, text, hint }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">{title}</p>
      <p dir="auto" className="text-sm">“{text}”</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/**
 * The opener as each kind of call hears it. With customer details on: the stored line (inbound and
 * test calls, no lead details) beside an outbound call to a named lead, and the fallback when the
 * name is unknown. Otherwise the one stored line.
 */
export function OpenerPreview({ preview }) {
  const samples = preview?.first_message_samples;
  if (!preview?.first_message) return null;
  if (!samples) return <OpenerCard title="Opening line" text={preview.first_message} />;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <OpenerCard title="Inbound & test calls" text={preview.first_message} />
        <OpenerCard title="Outbound · lead “Rahul”" text={samples.named} />
      </div>
      <OpenerCard title="Outbound · name unknown" text={samples.anonymous} hint="The fallback when we don't have their name." />
      {(preview.first_message_warnings || []).map((w) => (
        <p key={w} className="text-[11px] text-amber-700">{w}</p>
      ))}
    </div>
  );
}

/** The system prompt, with protected blocks (regenerated on every save) collapsed and read-only. */
export function PromptText({ prompt }) {
  return (
    <div className="space-y-2">
      {splitProtected(prompt).map((part, i) => (part.type === 'text' ? (
        <pre key={i} dir="auto" className="whitespace-pre-wrap text-xs leading-relaxed font-mono bg-muted rounded-lg p-3 border border-border">{part.text}</pre>
      ) : (
        <details key={i} className="rounded-lg border border-dashed border-border bg-muted/40" data-testid={`protected-${part.name}`}>
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            {part.title}
            <span className="font-normal text-muted-foreground">· protected, read-only, regenerated on every save</span>
          </summary>
          <pre dir="auto" className="whitespace-pre-wrap text-xs leading-relaxed font-mono px-3 pb-3 text-muted-foreground">{part.text}</pre>
        </details>
      )))}
    </div>
  );
}
