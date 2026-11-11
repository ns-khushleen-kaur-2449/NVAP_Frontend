import React from 'react';
import { FileCode2, Lock } from 'lucide-react';
import { Textarea } from '../../ui/textarea';
import { Field, FieldMessages, Section } from './BuilderFields';

export const CUSTOM_PROMPT_MAX = 20000;

const MODES = [
  { value: 'guided', label: 'Guided', hint: 'The builder writes the prompt from the form' },
  { value: 'custom', label: 'Custom prompt', hint: 'Write your own instructions; the platform keeps its safety rules and tools' },
];

/**
 * Guided or custom prompt mode (the backend's ``prompt_mode``). In custom mode the client writes the
 * agent's instructions; identity, truth rules, call details and the tools section stay generated
 * around them (app/features/assistant_builder/custom_prompt.py). Only Tenant Admins (and Super Admins)
 * may switch or edit it; others see it read-only.
 */
export default function PromptModeSection({ mode, onMode, prompt, onPrompt, canEdit, errors = [] }) {
  return (
    <Section icon={FileCode2} title="Prompt mode" description="Let the builder write the prompt, or write your own instructions">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Prompt mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            disabled={!canEdit}
            onClick={() => mode !== m.value && onMode(m.value)}
            className={`text-left rounded-lg border p-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${mode === m.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
          >
            <p className="text-sm font-medium">{m.label}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{m.hint}</p>
          </button>
        ))}
      </div>
      {!canEdit && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Lock className="w-3 h-3" /> Only a Tenant Admin can change the prompt mode or the custom prompt.
        </p>
      )}
      {mode === 'custom' && (
        <Field
          label="Your instructions"
          required
          hint="How the agent should run the call. Added after the platform's identity, truth rules, call details and tools, which always apply and can't be overridden. No prices; name only tools you selected."
        >
          <Textarea
            dir="auto"
            value={prompt}
            maxLength={CUSTOM_PROMPT_MAX}
            readOnly={!canEdit}
            onChange={(e) => onPrompt(e.target.value)}
            placeholder="e.g. You're calling past customers about the spring service camp. Ask which car they drive and when it was last serviced, then offer a slot."
            aria-label="Custom system prompt"
            className="bg-muted border-border min-h-[220px] text-sm"
          />
          <p className="text-[11px] text-muted-foreground text-right">{prompt.length}/{CUSTOM_PROMPT_MAX}</p>
          <FieldMessages errors={errors} />
        </Field>
      )}
    </Section>
  );
}
