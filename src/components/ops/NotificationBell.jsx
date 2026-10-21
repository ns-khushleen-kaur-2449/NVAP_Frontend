import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertOctagon, AlertTriangle, Bell, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead,
} from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { notificationLink, planToasts, toastText } from '@/lib/ops';
import RelativeTime from './RelativeTime';
import { EmptyState, ErrorState, SkeletonRows } from './States';

export const POLL_MS = 30000;
export const LIST_LIMIT = 20;
const WARNING_TOAST_MS = 8000;

const SEVERITY = {
  critical: { icon: AlertOctagon, label: 'Critical', className: 'text-[color:var(--ops-bad)]' },
  warning: { icon: AlertTriangle, label: 'Warning', className: 'text-[color:var(--ops-warn)]' },
  info: { icon: Info, label: 'Info', className: 'text-[color:var(--ops-info)]' },
};

/**
 * The bell: unread count (polled every 30 s while the tab is visible), the latest 20 in a
 * dropdown, "Mark all read", and a toast for each new warning / critical since the last poll
 * (at most 3; the rest collapse into "+N more"). Critical toasts stay until dismissed.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const seen = useRef(null); // ids already shown or present at first load
  const lastCount = useRef(null);

  const openItem = useCallback(async (item) => {
    if (!item.read_at) {
      try { await markNotificationRead(item.id); } catch { /* the link still works */ }
    }
    setOpen(false);
    const link = notificationLink(item);
    if (link) navigate(link);
  }, [navigate]);

  const showToasts = useCallback((list) => {
    if (seen.current === null) {
      // First load: what is already there is not "new since the last poll".
      seen.current = new Set(list.map((n) => n.id));
      return;
    }
    const { shown, more } = planToasts(list, seen.current);
    list.forEach((n) => seen.current.add(n.id));
    shown.forEach((n) => {
      const options = {
        id: `notification-${n.id}`,
        duration: n.severity === 'critical' ? Infinity : WARNING_TOAST_MS,
        closeButton: true,
        action: notificationLink(n) ? { label: 'View', onClick: () => openItem(n) } : undefined,
      };
      (n.severity === 'critical' ? toast.error : toast.warning)(toastText(n), options);
    });
    if (more > 0) {
      toast(`+${more} more`, { id: 'notification-more', duration: WARNING_TOAST_MS,
        action: { label: 'Show all', onClick: () => setOpen(true) } });
    }
  }, [openItem]);

  const loadList = useCallback(async () => {
    try {
      const res = await getNotifications({ limit: LIST_LIMIT });
      setItems(res.data.notifications);
      setCount(res.data.unread_count);
      setError(null);
      return res.data.notifications;
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : 'Check your connection and try again.');
      return null;
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await getUnreadNotificationCount();
      const unread = res.data.unread_count;
      setCount(unread);
      // Only fetch the list when something changed (or the first time).
      if (lastCount.current === null || unread > lastCount.current) {
        const list = await loadList();
        if (list) showToasts(list);
      }
      lastCount.current = unread;
    } catch {
      // The bell stays as it was; the next poll tries again.
    }
  }, [loadList, showToasts]);

  usePolling(poll, POLL_MS);

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setCount(0);
      lastCount.current = 0;
      await loadList();
    } catch {
      toast.error('Could not mark them read. Try again.');
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) loadList(); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-[hsl(var(--surface-2))] focus-visible:outline focus-visible:outline-2">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {count > 0 && (
            <span aria-hidden="true"
              className="ops-num absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-[#B04E14] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="ops w-[min(380px,calc(100vw-32px))] rounded-[14px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button type="button" onClick={markAll} disabled={!count}
            className="text-xs font-semibold text-[color:var(--ops-accent-ink)] disabled:opacity-50">
            Mark all read
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {error && <ErrorState message={error} onRetry={loadList} />}
          {!error && items === null && <SkeletonRows rows={3} label="Loading notifications" />}
          {!error && items?.length === 0 && <EmptyState title="No notifications yet." />}
          {!error && items?.length > 0 && (
            <ul className="space-y-1">
              {items.map((n) => {
                const meta = SEVERITY[n.severity] || SEVERITY.info;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => openItem(n)}
                      className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left hover:bg-[hsl(var(--surface-2))] ${n.read_at ? '' : 'bg-[hsl(var(--surface-2))]/60'}`}>
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{meta.label}{n.read_at ? '' : ', unread'}: </span>
                        <span className={`block text-sm ${n.read_at ? '' : 'font-semibold'}`}>{n.title}</span>
                        {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                        <RelativeTime iso={n.created_at} focusable={false} className="text-[11px] text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
