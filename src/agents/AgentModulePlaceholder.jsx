import { Construction } from 'lucide-react';
import { Panel } from '../components/primitives';

/** Shown inside an agent-specific tab until that agent's backend endpoints are wired up. */
export default function AgentModulePlaceholder({ title, planned = [] }) {
  return (
    <Panel className="p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--nv-orange-soft)] text-[var(--nv-orange-ink)]">
          <Construction className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-[var(--nv-muted)]">Will be built against this agent's backend API.</p>
          <ul className="mt-4 space-y-1.5 text-sm list-disc pl-5">
            {planned.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
