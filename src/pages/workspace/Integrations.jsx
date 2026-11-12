import { workspaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import { AsyncBoundary, Badge, Button, PageHeader, Panel } from '../../components/primitives';

const STATUS = {
  connected: { tone: 'success', label: 'Connected', action: 'Manage' },
  error: { tone: 'danger', label: 'Needs attention', action: 'Reconnect' },
  not_connected: { tone: 'neutral', label: 'Not connected', action: 'Connect' },
};

/**
 * Customer-owned systems (doc §14.4, FR-ACCESS-04/05). OAuth where supported;
 * scoped API key as fallback, never redisplayed after entry. The voice stack
 * (Twilio/Vapi/ElevenLabs/Nylas accounts) is NVIP-managed and never shown here.
 */
export default function Integrations() {
  const query = useNvipQuery(() => workspaceApi.integrations(), []);
  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect the systems your agents read from and write to." />
      <AsyncBoundary query={query}>
        {(items) => (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((i) => {
              const s = STATUS[i.status] ?? STATUS.not_connected;
              return (
                <Panel key={i.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{i.name}</div>
                      <div className="text-sm text-[var(--nv-muted)]">{i.kind === 'oauth' ? 'OAuth connection' : 'Scoped API key'}</div>
                    </div>
                    <Badge tone={s.tone} dot>{s.label}</Badge>
                  </div>
                  {i.detail && <p className="mt-3 text-sm">{i.detail}</p>}
                  <div className="mt-auto pt-4">
                    <Button variant="secondary" size="sm" disabled title="Available once the integrations API is connected">{s.action}</Button>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}
