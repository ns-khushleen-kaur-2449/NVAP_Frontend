import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getAgentByType } from '../config/agents';
import { LifecycleBadge } from './primitives';

/** Tenant's agent instances (doc §29.3 "My Agents"). Collapses to cards below md. */
export default function AgentsTable({ agents }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--nv-line)] text-xs uppercase tracking-wider text-[var(--nv-muted)]">
              <th className="px-5 py-3 font-semibold">Agent</th>
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold">Phone number</th>
              <th className="px-5 py-3 font-semibold">Lifecycle</th>
              <th className="px-5 py-3 font-semibold text-right">Calls (7d)</th>
              <th className="px-5 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b border-[var(--nv-line)] last:border-0 hover:bg-[var(--nv-surface-2)]">
                <td className="px-5 py-4 font-semibold">{a.name}</td>
                <td className="px-5 py-4 text-[var(--nv-muted)]">{getAgentByType(a.type)?.shortName ?? a.type}</td>
                <td className="px-5 py-4 text-[var(--nv-muted)] tabular-nums">{a.phoneNumber || '—'}</td>
                <td className="px-5 py-4"><LifecycleBadge state={a.lifecycle} /></td>
                <td className="px-5 py-4 text-right tabular-nums">{a.calls7d}</td>
                <td className="px-5 py-4 text-right">
                  <Link to={`/app/agents/${a.id}`} className="inline-flex items-center gap-1 font-medium text-[var(--nv-orange-ink)] hover:underline">
                    Open <ArrowRight className="h-4 w-4" aria-hidden /><span className="sr-only"> {a.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-[var(--nv-line)]">
        {agents.map((a) => (
          <li key={a.id}>
            <Link to={`/app/agents/${a.id}`} className="flex items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{a.name}</div>
                <div className="text-sm text-[var(--nv-muted)]">
                  {getAgentByType(a.type)?.shortName} · {a.phoneNumber || 'No number'} · {a.calls7d} calls (7d)
                </div>
              </div>
              <LifecycleBadge state={a.lifecycle} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
