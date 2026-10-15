import { Badge } from '@/components/ui/badge';
import { STAGE_COLORS, PRIORITY_COLORS, normalizeStage } from '@/lib/utils';

export const StageBadge = ({ stage: raw }) => {
  const stage = normalizeStage(raw);
  const classes = STAGE_COLORS[stage] || STAGE_COLORS.new;
  const label = stage ? stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
  return (
    <Badge variant="outline" className={`${classes} text-xs px-2 py-0.5`}>
      {label}
    </Badge>
  );
};

export const PriorityBadge = ({ priority }) => {
  const classes = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  return (
    <Badge variant="outline" className={`${classes} text-xs px-2 py-0.5 border-0`}>
      {priority?.charAt(0).toUpperCase() + priority?.slice(1) || 'N/A'}
    </Badge>
  );
};

export const StatusBadge = ({ status, type = 'default' }) => {
  const colorMap = {
    // Green (Success/Active)
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    available: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    
    // Blue (In Progress/Upcoming/Cold)
    cold: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
    scheduled: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
    upcoming: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
    in_progress: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
    running: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
    
    // Amber/Yellow (Warning/Pending/Warm)
    warm: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    paused: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    stale: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    reserved: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    retry_pending: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/30',
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    
    // Red (Error/Danger/Hot)
    hot: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    missed: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    sold: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/10', // Neutral for sold
    no_show: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    failed: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    error: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    manual_followup_required: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/30 font-semibold',
  };
  const classes = colorMap[status?.toLowerCase()] || 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20';
  return (
    <Badge variant="outline" className={`${classes} text-xs px-2 py-0.5 shadow-sm`}>
      {status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}
    </Badge>
  );
};
