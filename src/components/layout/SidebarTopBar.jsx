import NotificationBell from '@/components/ops/NotificationBell';

/** The thin bar above pages in the sidebar layout: notifications on the right. */
export default function SidebarTopBar() {
  return (
    <div className="sticky top-0 z-30 flex h-12 items-center justify-end gap-2 border-b border-border bg-background/90 px-4 backdrop-blur">
      <NotificationBell />
    </div>
  );
}
