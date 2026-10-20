import { useState } from 'react';
import { formatHour, formatHourLong } from '@/lib/voiceDashboard';

const PLOT_HEIGHT = 160;

function Legend() {
  return (
    <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
      <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--vd-dialed)]" aria-hidden="true" />Dialed</li>
      <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--vd-connected)]" aria-hidden="true" />Connected</li>
    </ul>
  );
}

/** Dialed vs connected per local hour, plus the backend's best connect window. */
export default function HourlyCallsChart({ byHour, bestWindow, multiDay }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...byHour.map((row) => row.dialed));
  const peak = byHour.reduce((best, row) => (row.dialed > (best?.dialed ?? -1) ? row : best), null);

  return (
    <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4" aria-labelledby="vd-hours-title">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 id="vd-hours-title" className="text-sm font-semibold text-foreground">
          Calls by hour{multiDay ? ' of day' : ''}
        </h2>
        <Legend />
      </div>

      {byHour.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No calls in this period yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            <div className="relative flex items-end gap-1 border-b border-border" style={{ height: PLOT_HEIGHT }}>
              {byHour.map((row) => {
                const label = `${formatHourLong(row.hour)}: ${row.dialed} dialed, ${row.connected} connected`;
                return (
                  <div
                    key={row.hour}
                    tabIndex={0}
                    aria-label={label}
                    onMouseEnter={() => setActive(row.hour)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(row.hour)}
                    onBlur={() => setActive(null)}
                    className="relative flex-1 h-full flex items-end justify-center gap-[2px] rounded-t outline-none focus-visible:ring-2 focus-visible:ring-[var(--vd-accent)] hover:bg-[hsl(var(--surface-2))]"
                  >
                    {row === peak && row.dialed > 0 && (
                      <span className="absolute text-[11px] tabular-nums text-muted-foreground"
                            style={{ bottom: (row.dialed / max) * (PLOT_HEIGHT - 18) + 2 }}>
                        {row.dialed}
                      </span>
                    )}
                    <span className="w-full max-w-[14px] rounded-t bg-[var(--vd-dialed)]" style={{ height: (row.dialed / max) * (PLOT_HEIGHT - 18) }} />
                    <span className="w-full max-w-[14px] rounded-t bg-[var(--vd-connected)]" style={{ height: (row.connected / max) * (PLOT_HEIGHT - 18) }} />
                    {active === row.hour && (
                      <div role="tooltip" className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
                        <p className="font-semibold">{formatHourLong(row.hour)}</p>
                        <p>{row.dialed} dialed · {row.connected} connected</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 pt-1.5" aria-hidden="true">
              {byHour.map((row) => (
                <span key={row.hour} className="flex-1 text-center text-[11px] text-muted-foreground">{formatHour(row.hour)}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <table className="sr-only">
        <caption>Calls by hour</caption>
        <thead><tr><th scope="col">Hour</th><th scope="col">Dialed</th><th scope="col">Connected</th></tr></thead>
        <tbody>
          {byHour.map((row) => (
            <tr key={row.hour}><th scope="row">{formatHourLong(row.hour)}</th><td>{row.dialed}</td><td>{row.connected}</td></tr>
          ))}
        </tbody>
      </table>

      <p className="mt-auto text-xs text-muted-foreground">
        {bestWindow
          ? <>Best connect window{multiDay ? '' : ' so far'}: <span className="font-semibold text-foreground">{formatHourLong(bestWindow.start_hour)}–{formatHourLong(bestWindow.end_hour)}</span> ({bestWindow.connected} of {bestWindow.dialed} dials answered)</>
          : 'No connected calls yet, so there is no best connect window.'}
      </p>
    </section>
  );
}
