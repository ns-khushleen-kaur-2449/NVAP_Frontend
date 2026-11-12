import { workspaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { getAgentByType } from '../../config/agents';
import { AsyncBoundary, Badge, ButtonLink, EmptyState, PageHeader, Panel } from '../../components/primitives';

const STATUS_TONE = { active: 'success', provisioning: 'info', past_due: 'warning', suspended: 'danger' };
const STATUS_LABEL = { active: 'Active', provisioning: 'Provisioning', past_due: 'Past due', suspended: 'Suspended' };

/** Orders & subscriptions (doc §29.3, FR-PRICE-02/05, Pax8 billing source §30.15). */
export default function Orders() {
  const query = useNvipQuery(() => workspaceApi.orders(), []);
  return (
    <>
      <PageHeader title="Orders & Subscriptions" subtitle="Each order keeps the exact price you accepted." actions={<ButtonLink to="/pricing" variant="secondary">Compare plans</ButtonLink>} />
      <Panel>
        <AsyncBoundary query={query}>
          {(orders) => !orders.length ? <EmptyState title="No orders yet" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--nv-line)] text-xs uppercase tracking-wider text-[var(--nv-muted)]">
                    {['Order', 'Agent', 'Plan', 'Price snapshot', 'Billed via', 'Status', 'Renews'].map((h) => (
                      <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-[var(--nv-line)] last:border-0">
                      <td className="px-5 py-4 font-mono text-xs">{o.id}</td>
                      <td className="px-5 py-4 font-semibold">{getAgentByType(o.agentType)?.name}</td>
                      <td className="px-5 py-4">{o.tier}</td>
                      <td className="px-5 py-4 tabular-nums">{o.priceSnapshot}</td>
                      <td className="px-5 py-4">
                        <Badge tone={o.billingSource === 'pax8' ? 'info' : 'neutral'}>{o.billingSource === 'pax8' ? 'Pax8' : 'NVIP'}</Badge>
                      </td>
                      <td className="px-5 py-4"><Badge tone={STATUS_TONE[o.status]} dot>{STATUS_LABEL[o.status] ?? o.status}</Badge></td>
                      <td className="px-5 py-4 text-[var(--nv-muted)] tabular-nums">{o.renewsAt ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncBoundary>
      </Panel>
      <p className="mt-3 text-sm text-[var(--nv-muted)]">Pax8-billed subscriptions are changed through the Pax8 Marketplace.</p>
    </>
  );
}
