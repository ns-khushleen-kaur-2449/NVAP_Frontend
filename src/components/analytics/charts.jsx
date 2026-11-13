/**
 * Shared chart library for Dashboard and Reports. Every plotted chart has titled axes with units, a hover
 * tooltip with the exact label and value, and a legend when it has more than one series. Colours: categorical
 * series take --viz-* in fixed order (index.css); --ops-* status colours are used only for states.
 */
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/ops/StatusBadge';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const SERIES = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)'];
export const STATUS = { good: 'var(--ops-good)', warn: 'var(--ops-warn)', bad: 'var(--ops-bad)', info: 'var(--ops-info)', muted: 'var(--viz-muted)' };

const AXIS = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const VALUE_LABEL = { fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 };
const GRID = 'hsl(var(--border))';
const SURFACE = 'hsl(var(--card))';
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v);
const fmtValue = (v, { unit = '', prefix = '' } = {}) => `${prefix}${fmt(v)}${unit}`;

/** ⓘ beside a metric: its definition on hover and on keyboard focus. */
export function InfoTip({ text, label }) {
  if (!text) return null;
  return (
    <UiTooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`Definition of ${label}`} className="inline-flex rounded text-muted-foreground hover:text-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-left font-normal leading-snug">{text}</TooltipContent>
    </UiTooltip>
  );
}

/** The hover card plotted charts share: the category, then one row per series with its exact value. */
function TipBox({ active, payload, label, unit, prefix, extra }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
      {label !== undefined && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={`${p.dataKey}-${p.name}`} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.payload?.fill || p.color }} aria-hidden="true" />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ops-num ml-auto pl-3 font-semibold">{fmtValue(p.value, { unit, prefix })}</span>
        </p>
      ))}
      {extra && extra(payload[0].payload)}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {items.map(([label, color]) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />{label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Axis titles sit outside the plot as text so they never collide with tick labels: the y title above the plot
 * at the left, the x title centred below it.
 */
function Frame({ xTitle, yTitle, legend, height, label, children }) {
  return (
    <figure className="m-0" aria-label={label}>
      {yTitle && <p className="mb-1 text-xs font-medium text-muted-foreground">{yTitle}</p>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
      {xTitle && <p className="mt-1 text-center text-xs font-medium text-muted-foreground">{xTitle}</p>}
      {legend && legend.length > 1 && <Legend items={legend} />}
    </figure>
  );
}

const MARGIN = { top: 8, right: 12, bottom: 0, left: 0 };
const hoverFill = { fill: 'hsl(var(--surface-2))' };

/** A KPI card's trend: no axes, a tooltip per point. `labels` names each point (e.g. the day). */
export function Sparkline({ data, labels, name, unit = '', bar }) {
  const points = data.map((v, i) => ({ x: labels?.[i] ?? `Day ${i + 1}`, v }));
  const tip = <Tooltip content={<TipBox unit={unit} />} cursor={false} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 20 }} />;
  return (
    <div className="h-8 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="x" hide />{tip}
            <Bar dataKey="v" name={name} fill="var(--viz-2)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis dataKey="x" hide /><YAxis hide domain={['dataMin', 'dataMax']} />{tip}
            <Line dataKey="v" name={name} stroke="var(--viz-2)" strokeWidth={2} dot={false} isAnimationActive={false}
              activeDot={{ r: 3.5, stroke: SURFACE, strokeWidth: 2 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const DELTA_ICON = { good: TrendingUp, bad: TrendingDown, warn: TrendingDown, neutral: Minus };
const SPARK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** One KPI: label with its definition, value, change (direction in words, not colour alone), 7-day sparkline. */
export function KpiCard({ kpi }) {
  const Icon = DELTA_ICON[kpi.tone] || Minus;
  return (
    <div className="ops-card flex min-w-0 flex-col gap-1.5 p-4" data-testid={`kpi-${kpi.id}`}>
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{kpi.label}<InfoTip text={kpi.info} label={kpi.label} /></p>
      {kpi.unavailable ? (
        <>
          <p className="text-base font-semibold text-muted-foreground">Data not available yet</p>
          <p className="text-xs text-muted-foreground">{kpi.unavailable}</p>
        </>
      ) : (<>
        <div className="flex items-end justify-between gap-2">
          <p className="ops-num whitespace-nowrap text-2xl font-semibold tracking-tight">{kpi.value}</p>
          {kpi.trend && <Sparkline data={kpi.trend} labels={SPARK_DAYS} name={kpi.label} unit={kpi.unit} bar={kpi.bar} />}
        </div>
        {kpi.delta && (
          <span className={cn('ops-tone inline-flex w-fit max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium', `ops-tone-${kpi.tone || 'neutral'}`)}>
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate" title={kpi.delta}>{kpi.delta}</span>
          </span>
        )}
        {kpi.note && <p className="text-xs text-muted-foreground">{kpi.note}</p>}
      </>)}
    </div>
  );
}

const rowsHeight = (n) => Math.max(120, n * 38 + 24);

/** Funnel: stages as horizontal bars on one count axis. The tooltip adds the share kept and how many were lost. */
export function FunnelChart({ stages, xTitle = 'Prospects (count)', yTitle = 'Stage', highlightLargestDrop }) {
  const rows = stages.map((s, i) => ({
    ...s,
    kept: i ? Math.round((s.count / stages[i - 1].count) * 100) : null,
    lost: i ? stages[i - 1].count - s.count : null,
  }));
  let drop = -1;
  if (highlightLargestDrop) {
    let worst = 101;
    rows.forEach((r, i) => { if (i && r.kept < worst) { worst = r.kept; drop = i; } });
  }
  return (
    <Frame xTitle={xTitle} yTitle={yTitle} height={rowsHeight(rows.length)} label="Funnel">
      <BarChart data={rows} layout="vertical" margin={{ ...MARGIN, right: 48 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={AXIS} tickLine={false} axisLine={false} width={118} />
        <Tooltip cursor={hoverFill} content={<TipBox extra={(r) => r.kept !== null && (
          <p className="mt-1 border-t border-border pt-1 text-muted-foreground">{r.kept}% kept from the stage before · {r.lost.toLocaleString()} lost</p>
        )} />} />
        <Bar dataKey="count" name="Prospects" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          {rows.map((r, i) => <Cell key={r.stage} fill={i === drop ? STATUS.bad : 'var(--viz-2)'} />)}
          <LabelList dataKey="count" position="right" style={VALUE_LABEL} formatter={fmt} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/** Ranked horizontal bars of one measure. `colorFor(row)` may mark a row (e.g. the slowest). */
export function HBarChart({ data, category, value, name, xTitle, yTitle, unit = '', max, colorFor, valueText }) {
  return (
    <Frame xTitle={xTitle} yTitle={yTitle} height={rowsHeight(data.length)} label={name}>
      <BarChart data={data} layout="vertical" margin={{ ...MARGIN, right: 64 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} domain={[0, max || 'auto']} tickFormatter={(v) => `${v}${unit}`} />
        <YAxis type="category" dataKey={category} tick={AXIS} tickLine={false} axisLine={false} width={118} />
        <Tooltip cursor={hoverFill} content={<TipBox unit={unit} />} />
        <Bar dataKey={value} name={name} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((r) => <Cell key={r[category]} fill={colorFor?.(r) || 'var(--viz-1)'} />)}
          <LabelList dataKey={value} position="right" style={VALUE_LABEL} formatter={(v) => (valueText ? valueText(v) : `${fmt(v)}${unit}`)} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/** Rows split into parts as stacked horizontal bars (e.g. each rep's workload by temperature). */
export function StackedHBarChart({ data, category, series, xTitle, yTitle }) {
  const last = series.length - 1;
  return (
    <Frame xTitle={xTitle} yTitle={yTitle} height={rowsHeight(data.length)} legend={series.map((s) => [s.name, s.color])} label={xTitle}>
      <BarChart data={data} layout="vertical" margin={MARGIN}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey={category} tick={AXIS} tickLine={false} axisLine={false} width={96} />
        <Tooltip cursor={hoverFill} content={<TipBox />} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} stroke={SURFACE} strokeWidth={1}
            radius={i === last ? [0, 4, 4, 0] : 0} maxBarSize={22} isAnimationActive={false} />
        ))}
      </BarChart>
    </Frame>
  );
}

/** Vertical columns per category: `stacked` (parts of a total) or clustered side by side. One y-axis only. */
export function ColumnChart({ data, x, series, stacked, xTitle, yTitle, unit = '', prefix = '', height = 220 }) {
  const last = series.length - 1;
  return (
    <Frame xTitle={xTitle} yTitle={yTitle} height={height} legend={series.map((s) => [s.name, s.color])} label={yTitle}>
      <BarChart data={data} margin={MARGIN} barGap={2} barCategoryGap={stacked ? '30%' : '18%'}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} tickFormatter={(v) => `${prefix}${v}${unit}`} />
        <Tooltip cursor={hoverFill} content={<TipBox unit={unit} prefix={prefix} />} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined}
            stroke={stacked ? SURFACE : undefined} strokeWidth={stacked ? 1 : 0} isAnimationActive={false}
            radius={!stacked || i === last ? [4, 4, 0, 0] : 0} maxBarSize={stacked ? 44 : 28} />
        ))}
      </BarChart>
    </Frame>
  );
}

/** Lines over time, with an optional dashed goal line. */
export function LineTrendChart({ data, x, series, xTitle, yTitle, unit = '', domain, goal, height = 220 }) {
  return (
    <Frame xTitle={xTitle} yTitle={yTitle} height={height} legend={series.map((s) => [s.name, s.color])} label={yTitle}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} domain={domain} tickFormatter={(v) => `${v}${unit}`} />
        {goal && <ReferenceLine y={goal} stroke="var(--ops-good)" strokeDasharray="4 4" label={{ value: `Goal ${goal}${unit}`, position: 'insideTopRight', ...AXIS }} />}
        <Tooltip cursor={{ stroke: GRID }} content={<TipBox unit={unit} />} />
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} isAnimationActive={false}
            dot={{ r: 3, fill: s.color, stroke: SURFACE, strokeWidth: 1.5 }} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} />
        ))}
      </LineChart>
    </Frame>
  );
}

/** Parts of a whole as a donut. The tooltip and the legend give each part's count and share. */
export function DonutChart({ data, nameKey, valueKey = 'count', colors, unit, label }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  const share = (v) => (total ? Math.round((v / total) * 100) : 0);
  const rows = data.map((d, i) => ({ name: d[nameKey], value: d[valueKey], fill: colors[i] }));
  return (
    <figure className="m-0 flex flex-wrap items-center gap-6" aria-label={label}>
      <div className="relative h-[170px] w-[170px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip wrapperStyle={{ zIndex: 20 }} content={({ active, payload }) => (active && payload?.length ? (
              <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: payload[0].payload.fill }} aria-hidden="true" />{payload[0].name}
                </p>
                <p className="ops-num mt-0.5">{fmt(payload[0].value)} {unit} · {share(payload[0].value)}%</p>
              </div>
            ) : null)} />
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={1}
              stroke={SURFACE} strokeWidth={2} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.name} fill={r.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="ops-num text-xl font-semibold">{fmt(total)}</span>
          <span className="text-[0.7rem] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <ul className="min-w-[180px] flex-1 space-y-1.5 text-sm" aria-label="Legend">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.fill }} aria-hidden="true" />
            <span className="flex-1">{r.name}</span>
            <span className="ops-num font-semibold">{fmt(r.value)}</span>
            <span className="ops-num w-10 text-right text-xs text-muted-foreground">{share(r.value)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Usage against a limit. Turns warning from 80% and critical from 90%, and says so in words. */
export function Meter({ label, used, limit }) {
  const pct = Math.round((used / limit) * 100);
  const tone = pct >= 90 ? 'bad' : pct >= 80 ? 'warn' : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="ops-num text-xs text-muted-foreground"><span className="font-semibold text-foreground">{fmt(used)}</span> / {fmt(limit)} · {pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: tone ? STATUS[tone] : 'var(--viz-1)' }} />
      </div>
      {tone && <p className={cn('text-xs font-medium', tone === 'bad' ? 'text-[color:var(--ops-bad)]' : 'text-[color:var(--ops-warn)]')}>{tone === 'bad' ? 'Close to the limit' : 'Approaching the limit'}</p>}
    </div>
  );
}

export function DataTable({ columns, rows, numeric = [], className, minWidth = 420 }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            {columns.map((c, i) => <th key={c} scope="col" className={cn('px-2 py-2 font-semibold', numeric.includes(i) && 'text-right')}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {row.map((cell, i) => <td key={i} className={cn('px-2 py-2', i === 0 && 'font-medium', numeric.includes(i) && 'ops-num text-right')}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Items with a title, a detail line, an optional badge, and something on the right (badge or action). */
export function ItemList({ items }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{it.title}{it.badge && <StatusBadge label={it.badge[0]} tone={it.badge[1]} />}</p>
            {it.detail && <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p>}
          </div>
          {it.right}
        </li>
      ))}
    </ul>
  );
}
