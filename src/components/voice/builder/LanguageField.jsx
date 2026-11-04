import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { OptionSelect } from './BuilderFields';
import { languageOf, languageOptions, voiceStatus } from '../../../lib/builderLanguages';

/**
 * The agent's language: the one place the builder chooses it, from GET /api/v1/assistant-builder/languages (never a
 * list in code). Drafts show only when the API returns them, marked. Below: whether a voice is ready for the language
 * (and gender). Kept as one component so a per-lead language or an "also speaks" option can be added here later.
 */
export default function LanguageField({ languages, value, onChange, gender, loading, errors = [] }) {
  const options = languageOptions(languages, value);
  const chosen = languageOf(languages, value);
  const status = voiceStatus(languages, value, gender);
  return (
    <div className="space-y-1.5">
      <OptionSelect value={value} onChange={onChange} options={options} ariaLabel="Language"
        disabled={loading && !options.length} />
      {chosen?.status === 'draft' && (
        <p className="text-[11px] text-amber-700 flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Draft</Badge>
          Awaiting native review: internal testing only, not offered to clients.
        </p>
      )}
      {status && (status.ready ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1" data-testid="voice-status">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> Voice ready
        </p>
      ) : (
        <p className="text-[11px] text-amber-700 flex items-start gap-1" data-testid="voice-status" role="status">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" /> {status.problem}
        </p>
      ))}
      {errors.map((e) => <p key={e} className="text-[11px] text-red-600" role="alert">{e}</p>)}
    </div>
  );
}
