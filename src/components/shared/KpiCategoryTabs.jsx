import { useState, useRef } from 'react';

/**
 * KpiCategoryTabs
 *
 * Props:
 *   categories – array of { id, label, icon: LucideComponent, color?: string, content: ReactNode }
 *   defaultTab – id of the initially active tab (defaults to first)
 */
export default function KpiCategoryTabs({ categories = [], defaultTab }) {
  const [active, setActive] = useState(defaultTab ?? categories[0]?.id);
  const scrollRef = useRef(null);

  const current = categories.find((c) => c.id === active) ?? categories[0];

  return (
    <div className="space-y-0">
      {/* ── Tab Bar Container ── */}
      <div
        className="relative rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-md shadow-sm"
        style={{ padding: '6px 8px' }}
      >
        {/* Scrollable pill row */}
        <div
          ref={scrollRef}
          className="flex items-center gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = active === cat.id;
            const accentColor = cat.color ?? '#F87217';

            return (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs whitespace-nowrap shrink-0 transition-all duration-250 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={
                  isActive
                    ? {
                        background: `${accentColor}15`,
                        color: accentColor,
                        border: `1.5px solid ${accentColor}30`,
                        boxShadow: `0 2px 10px ${accentColor}18`,
                      }
                    : {
                        background: 'transparent',
                        color: '#64748b',
                        border: '1.5px solid transparent',
                      }
                }
              >
                {Icon && (
                  <Icon
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: isActive ? accentColor : '#94a3b8' }}
                  />
                )}
                {cat.label}
                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full ml-0.5"
                    style={{ background: accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content Panel ── */}
      <div
        key={active}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300 pt-8"
      >
        {current?.content}
      </div>
    </div>
  );
}
