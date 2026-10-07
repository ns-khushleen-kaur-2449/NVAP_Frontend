import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export default function KpiCard({
  title,
  value,
  subtitle = null,
  icon: Icon = Activity,
  color = '#F87217',
  trend = null,
  className = '',
  onClick = null
}) {
  return (
    <Card className={`card-base card-hover kpi-gradient ${className}`} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{title}</p>
            <div className="flex items-baseline gap-3">
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: color }}>
                {value}
              </p>
              {trend && (
                <div 
                  className={`flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    trend.direction === 'up' ? 'text-green-700 bg-green-500/10' : 'text-red-700 bg-red-500/10'
                  }`}
                >
                  {trend.direction === 'up' ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {trend.value}
                </div>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div
            className="p-2.5 rounded-xl shadow-inner border border-white/50"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-6 h-6" style={{ color: color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
