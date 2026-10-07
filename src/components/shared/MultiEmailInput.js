import { useState, forwardRef, useImperativeHandle } from 'react';

const parseDraft = (raw) => raw.trim().replace(/,+$/, '').split(/[,;\s]+/).filter(Boolean);

const MultiEmailInput = forwardRef(function MultiEmailInput({ emails, onChange, placeholder = 'recipient@example.com, …' }, ref) {
  const [val, setVal] = useState('');

  const add = () => {
    const parts = parseDraft(val);
    if (!parts.length) return;
    const next = [...new Set([...emails, ...parts])];
    onChange(next);
    setVal('');
  };

  // A user can click straight to a submit button without pressing Enter/comma or
  // tabbing away — whatever's still typed in the box never becomes a chip and would
  // otherwise be silently dropped. Callers that need the authoritative list right
  // before submitting (not just reacting to onChange) should call ref.current.flush()
  // instead of trusting the `emails` prop, since blur timing/React batching isn't
  // guaranteed to have committed it into state yet.
  useImperativeHandle(ref, () => ({
    flush: () => {
      const parts = parseDraft(val);
      if (!parts.length) return emails;
      const next = [...new Set([...emails, ...parts])];
      onChange(next);
      setVal('');
      return next;
    },
  }));

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !val && emails.length) {
      onChange(emails.slice(0, -1));
    }
  };

  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5 flex flex-wrap gap-1.5 focus-within:ring-1 focus-within:ring-[#F87217]/40">
      {emails.map((em) => (
        <span key={em} className="inline-flex items-center gap-1 bg-[#F87217]/10 text-[#F87217] text-xs px-2 py-0.5 rounded-full">
          {em}
          <button type="button" onClick={() => onChange(emails.filter((e) => e !== em))} className="hover:text-red-500 leading-none">&times;</button>
        </span>
      ))}
      <input
        type="email"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={emails.length ? '' : placeholder}
        className="flex-1 min-w-[160px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
});

export default MultiEmailInput;
