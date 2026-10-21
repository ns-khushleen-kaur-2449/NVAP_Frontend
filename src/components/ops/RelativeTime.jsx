import { useAuth } from '@/lib/AuthContext';
import { displayTimeZone, formatAbsolute, formatDateTime, relativeTime } from '@/lib/ops';

/**
 * A time shown relative ("16 min ago", "in 3 h") or as a short date ("Thu 23 Oct, 3:00 PM IST"),
 * with the full absolute time on hover and on keyboard focus (title + aria-label). Inside a
 * button or link pass focusable={false}: the control itself takes the focus.
 */
export default function RelativeTime({ iso, mode = 'relative', className = '', focusable = true }) {
  const { user } = useAuth();
  if (!iso) return <span className={className}>—</span>;
  const zone = displayTimeZone(user);
  const absolute = formatAbsolute(iso, zone);
  const shown = mode === 'relative' ? relativeTime(iso) : formatDateTime(iso, zone);
  return (
    <time dateTime={iso} title={absolute} aria-label={`${shown} (${absolute})`} tabIndex={focusable ? 0 : undefined}
      className={`ops-num rounded-sm focus-visible:outline focus-visible:outline-2 ${className}`}>
      {shown}
    </time>
  );
}
