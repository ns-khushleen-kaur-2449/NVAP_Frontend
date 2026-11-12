import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, Phone } from 'lucide-react';
import { marketplaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import {
  AgentTile, AsyncBoundary, ButtonLink, EmptyState, GuardrailChips, Panel, TextLink,
} from '../../components/primitives';

function ListBlock({ title, items }) {
  return (
    <Panel className="p-6">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-[var(--nv-muted)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nv-success)]" aria-hidden /> {i}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Agent brochure page (doc §29.2). Sample transcript / live sandbox widget plug in here later. */
export default function AgentDetail() {
  const { slug } = useParams();
  const query = useNvipQuery(() => marketplaceApi.getAgent(slug), [slug]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <TextLink to="/" className="mb-8"><ArrowLeft className="h-4 w-4" aria-hidden /> All agents</TextLink>
      <AsyncBoundary query={query}>
        {(agent) => !agent ? (
          <EmptyState title="Agent not found" action={<ButtonLink to="/">Browse agents</ButtonLink>} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
              <AgentTile agent={agent} solid />
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{agent.name}</h1>
                <p className="mt-2 text-lg text-[var(--nv-muted)]">{agent.summary}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to={`/request-demo?agent=${agent.slug}`}><Phone className="h-4 w-4" aria-hidden /> Book a demo</ButtonLink>
              <ButtonLink to={`/pricing#${agent.slug}`} variant="secondary">See pricing — from ${agent.startingPrice}/mo</ButtonLink>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <ListBlock title="What it captures" items={agent.captures} />
              <ListBlock title="Tools & integrations" items={agent.tools} />
            </div>

            <Panel className="mt-6 p-6">
              <h2 className="font-semibold">Built-in guardrails</h2>
              <p className="mt-1 mb-4 text-sm text-[var(--nv-muted)]">Enforced by the platform — not left to the agent's judgment.</p>
              <GuardrailChips guardrails={agent.guardrails} />
            </Panel>

            <Panel className="mt-6 p-6 grid gap-4 sm:grid-cols-3 text-sm">
              <div><div className="text-[var(--nv-muted)]">Built for</div><div className="font-semibold mt-1">{agent.primaryUsers}</div></div>
              <div><div className="text-[var(--nv-muted)]">System of record</div><div className="font-semibold mt-1">{agent.systemOfRecord || 'Not required'}</div></div>
              <div><div className="text-[var(--nv-muted)]">Books</div><div className="font-semibold mt-1">{agent.booking}</div></div>
            </Panel>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
