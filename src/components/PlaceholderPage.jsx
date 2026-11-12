import { Construction } from 'lucide-react';
import { PageHeader, Panel } from './primitives';

/**
 * Stand-in for screens whose backend isn't ready yet. Lists what the screen
 * will contain (from the architecture doc) so the structure is reviewable now.
 */
export default function PlaceholderPage({ title, subtitle, planned = [], specRef }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Panel className="p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--nv-orange-soft)] text-[var(--nv-orange-ink)]">
            <Construction className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Waiting on backend integration</p>
            <p className="text-sm text-[var(--nv-muted)]">
              This screen is wired into navigation and access control.{specRef ? ` Spec: ${specRef}.` : ''}
            </p>
            {planned.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm list-disc pl-5">
                {planned.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
