import { Check } from 'lucide-react';
import { AGENTS, TIERS } from '../../config/agents';
import { AgentTile, ButtonLink, Panel } from '../../components/primitives';

/**
 * Pricing page (doc §13, FR-PRICE-01). Tier content comes from config/agents.js;
 * exact amounts, overage rates and setup fees will come from the pricing API
 * once the commercial team signs them off.
 */
export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight">Simple, per-agent pricing</h1>
        <p className="mt-4 text-lg text-[var(--nv-muted)]">
          Every agent has Starter, Growth and Enterprise tiers. Usage beyond what's included is itemized separately.
        </p>
      </div>

      <div className="mt-14 space-y-14">
        {AGENTS.map((agent) => (
          <section key={agent.type} id={agent.slug} className="scroll-mt-24">
            <div className="flex items-center gap-4 mb-5">
              <AgentTile agent={agent} size="sm" />
              <h2 className="text-2xl font-bold">{agent.name}</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {(TIERS[agent.type] || []).map((tier, i) => {
                const enterprise = tier.id === 'enterprise';
                return (
                  <Panel key={tier.id} className="flex flex-col p-6">
                    <div className="font-semibold text-[var(--nv-muted)]">{tier.name}</div>
                    <div className="mt-2 text-3xl font-bold">
                      {enterprise ? 'Custom' : i === 0 ? `$${agent.startingPrice}` : 'TBD'}
                      {!enterprise && <span className="text-base font-medium text-[var(--nv-muted)]">/mo</span>}
                    </div>
                    <ul className="mt-5 space-y-2 text-sm">
                      {tier.included.map((line) => (
                        <li key={line} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nv-success)]" aria-hidden /> {line}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-6">
                      {enterprise
                        ? <ButtonLink to={`/request-quote?agent=${agent.slug}`} variant="secondary" className="w-full">Request a quote</ButtonLink>
                        : <ButtonLink to={`/request-demo?agent=${agent.slug}&tier=${tier.id}`} className="w-full">Get started</ButtonLink>}
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
