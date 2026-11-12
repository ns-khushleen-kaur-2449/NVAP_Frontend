import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '../../config/agents';
import { marketplaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { AgentTile, AsyncBoundary, ButtonLink, EmptyState } from '../../components/primitives';

function AgentCard({ agent }) {
  return (
    <Link
      to={`/agents/${agent.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl bg-[var(--nv-surface)] p-7 transition-shadow hover:shadow-lg',
        agent.popular ? 'border-2 border-[var(--nv-orange)]' : 'border border-[var(--nv-line)]',
      )}
    >
      <div className="flex items-start justify-between">
        <AgentTile agent={agent} solid={agent.popular} />
        {agent.popular && <span className="nv-eyebrow text-[var(--nv-orange)]">Most popular</span>}
      </div>
      <h3 className="mt-5 text-xl font-bold">{agent.name}</h3>
      <p className="mt-2 text-[var(--nv-muted)] leading-relaxed">{agent.summary}</p>
      <div className="mt-auto pt-5">
        <span className="inline-block rounded-full bg-[var(--nv-orange-soft)] px-3 py-1 text-sm font-semibold text-[var(--nv-orange-ink)]">
          From ${agent.startingPrice}/mo
        </span>
        <div className="mt-3 flex items-center gap-1 font-semibold text-[var(--nv-orange-ink)]">
          View details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
      </div>
    </Link>
  );
}

function CustomCard() {
  return (
    <div className="flex flex-col rounded-2xl bg-[var(--nv-feature-bg)] p-7 text-[var(--nv-feature-fg)]">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--nv-feature-raised)] text-[var(--nv-orange-ink)]">
        <Sparkles className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-5 text-xl font-bold">Need something custom?</h3>
      <p className="mt-2 text-[var(--nv-feature-muted)] leading-relaxed">
        MSP Service Desk, Voice Commerce and more agents are on the roadmap — talk to us.
      </p>
      <div className="mt-auto pt-5">
        <ButtonLink to="/request-quote" variant="feature">Contact sales <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
      </div>
    </div>
  );
}

export default function AgentCatalog() {
  const [category, setCategory] = useState('all');
  const query = useNvipQuery(() => marketplaceApi.listAgents(), []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-20">
      <section className="text-center max-w-3xl mx-auto">
        <p className="nv-eyebrow text-[var(--nv-orange-ink)]">● One platform · Many voice agents</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">Pick the voice agent your business needs</h1>
        <p className="mt-5 text-lg text-[var(--nv-muted)]">
          Every agent runs on the same trusted platform — your CRM, ATS or property system stays the system of record.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/request-demo" size="lg"><Phone className="h-4 w-4" aria-hidden /> Book a demo</ButtonLink>
          <ButtonLink to="/request-quote" size="lg" variant="secondary">Get a quote</ButtonLink>
        </div>
      </section>

      <div className="mt-14 flex flex-wrap justify-center gap-3" role="tablist" aria-label="Filter agents by category">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'rounded-full px-5 py-2.5 font-semibold transition-colors',
              category === c.id
                ? 'bg-[var(--nv-orange)] text-white'
                : 'border border-[var(--nv-line)] bg-[var(--nv-surface)] text-[var(--nv-ink)] hover:border-[var(--nv-orange)]',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <AsyncBoundary query={query} loadingLabel="Loading agents…">
          {(agents) => {
            const shown = category === 'all' ? agents : agents.filter((a) => a.category === category);
            return (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((agent) => <AgentCard key={agent.type} agent={agent} />)}
                {shown.length === 0 && (
                  <div className="sm:col-span-2"><EmptyState title="No agents in this category yet" /></div>
                )}
                <CustomCard />
              </div>
            );
          }}
        </AsyncBoundary>
      </div>
    </div>
  );
}
