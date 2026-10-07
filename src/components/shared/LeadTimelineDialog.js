import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Timeline } from '@/components/shared/Timeline';
import { getLeadEvents } from '@/lib/api';

export default function LeadTimelineDialog({ leadId, leadName, open, onOpenChange }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !leadId) return;
    setLoading(true);
    getLeadEvents(leadId).then((r) => setEvents(r.data || [])).catch(() => setEvents([])).finally(() => setLoading(false));
  }, [open, leadId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{leadName || 'Lead'}'s journey</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <Timeline events={events} />
        )}
      </DialogContent>
    </Dialog>
  );
}
