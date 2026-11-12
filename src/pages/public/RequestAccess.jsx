import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { AGENTS } from '../../config/agents';
import { accessApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { Button, ButtonLink, Panel } from '../../components/primitives';
import Field from '../../components/Field';

const COPY = {
  demo: {
    title: 'Book a demo',
    subtitle: "Talk to a live, sandboxed agent. We'll send a calendar invite with a time that works.",
    submit: 'Request demo',
  },
  quote: {
    title: 'Request a quote',
    subtitle: 'Enterprise volumes, dedicated numbers, custom SLAs or a custom agent — our sales team will reply.',
    submit: 'Request quote',
  },
};

/** Demo & quote requests — no account required (FR-PORTAL-03, FR-PRICE-04). */
export default function RequestAccess({ kind }) {
  const copy = COPY[kind];
  const [params] = useSearchParams();
  const [status, setStatus] = useState({ sending: false, error: null, done: false });

  async function onSubmit(e) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    setStatus({ sending: true, error: null, done: false });
    try {
      await accessApi.submitRequest(kind, payload);
      setStatus({ sending: false, error: null, done: true });
    } catch (err) {
      setStatus({ sending: false, error: errorMessage(err), done: false });
    }
  }

  if (status.done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-[var(--nv-success)]" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Request received</h1>
        <p className="mt-2 text-[var(--nv-muted)]">Our team will be in touch within one business day.</p>
        <ButtonLink to="/" variant="secondary" className="mt-8">Back to agents</ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-[var(--nv-muted)]">{copy.subtitle}</p>

      <Panel className="mt-8 p-6 sm:p-8">
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="name" required autoComplete="name" />
          <Field label="Work email" name="email" type="email" required autoComplete="email" />
          <Field label="Company" name="company" required autoComplete="organization" />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
          <Field label="Agent of interest" name="agent" as="select" defaultValue={params.get('agent') || ''} className="sm:col-span-2">
            <option value="">Not sure yet</option>
            {AGENTS.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </Field>
          <input type="hidden" name="tier" value={params.get('tier') || ''} />
          <Field label="Anything we should know?" name="notes" as="textarea" className="sm:col-span-2" />
          {status.error && <p className="sm:col-span-2 text-sm text-[var(--nv-danger)]" role="alert">{status.error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={status.sending}>{status.sending ? 'Sending…' : copy.submit}</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
