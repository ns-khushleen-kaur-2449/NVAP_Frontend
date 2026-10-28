import React, { useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { Field, FieldMessages, Section } from './BuilderFields';
import { placeholdersFor } from '../../../lib/builderPersonalization';

/**
 * The opening line. With customer details on, the agent greets the lead (by name when we know it),
 * says who is calling and asks for a moment; the reason line is optional. A custom line may use the
 * placeholders the selection allows, rendered for each lead on outbound calls.
 */
export default function OpenerSection({
  personalized, firstMessage, onFirstMessage, leadFields, mentionsReason, onMentionsReason,
  defaultReason, onDefaultReason, generated, errors = {}, warnings = [],
}) {
  const box = useRef(null);
  // Where the caret was when the line lost focus (clicking a placeholder moves focus to the button);
  // null until the line was edited: placeholders are then added at the end.
  const caret = useRef(null);
  const remember = (e) => { caret.current = [e.target.selectionStart, e.target.selectionEnd]; };
  const insert = (token) => {
    const [start, end] = caret.current || [firstMessage.length, firstMessage.length];
    onFirstMessage(firstMessage.slice(0, start) + token + firstMessage.slice(end));
    caret.current = [start + token.length, start + token.length];
    requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Section icon={MessageCircle} title="Opening line" description="What the agent says the moment the call connects">
      {personalized && (
        <>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Say why we're calling in the opener</p>
              <p className="text-[11px] text-muted-foreground">Off: the agent asks for a moment first and gives the reason after a yes.</p>
            </div>
            <Switch checked={mentionsReason} onCheckedChange={onMentionsReason} aria-label="Say the reason in the opener" />
          </div>
          <Field label="Default reason for calling" hint="One spoken sentence. Used when a call has no campaign pitch (inbound, test and single calls). No prices.">
            <Input
              dir="auto"
              value={defaultReason}
              maxLength={300}
              onChange={(e) => onDefaultReason(e.target.value)}
              placeholder="e.g. I'm calling about your enquiry with Apex Motors."
              className="bg-muted border-border"
            />
            <FieldMessages errors={errors.default_call_reason} />
          </Field>
        </>
      )}
      <Field
        label="Custom opening line"
        hint={personalized
          ? 'Optional. Leave empty for the generated greeting. Placeholders are filled in for each lead.'
          : 'What the agent says the moment the call connects. Leave empty for a warm greeting built from your business details.'}
      >
        <Textarea
          ref={box}
          dir="auto"
          value={firstMessage}
          maxLength={500}
          onChange={(e) => onFirstMessage(e.target.value)}
          onBlur={remember}
          placeholder={generated || "e.g. Hi there! This is Riya from Apex Motors. Is this a good time to chat?"}
          aria-label="Custom opening line"
          className="bg-muted border-border min-h-[70px] resize-none"
        />
        {personalized && (
          <div className="flex flex-wrap gap-1.5" aria-label="Insert a placeholder">
            {placeholdersFor(leadFields).map((p) => (
              <button
                key={p.token}
                type="button"
                title={p.hint}
                onClick={() => insert(p.token)}
                className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
              >
                + {p.token}
              </button>
            ))}
          </div>
        )}
        {!firstMessage.trim() && generated && (
          <p dir="auto" className="text-[11px] text-muted-foreground">Will say: “{generated}”</p>
        )}
        <FieldMessages errors={errors.first_message} warnings={warnings} />
      </Field>
    </Section>
  );
}
