import { timeAgo } from '@/lib/utils';
import { Phone, Mail, MessageSquare, MapPin, Sparkles, FileText, ArrowRight, Send, CalendarClock } from 'lucide-react';

const eventIcons = {
  call: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  sms: MessageSquare,
  site_visit: MapPin,
  ai_qualification: Sparkles,
  note: FileText,
  stage_change: ArrowRight,
  assignment: ArrowRight,
  message: Send,
  meeting: CalendarClock,
};

export const Timeline = ({ events = [] }) => {
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No events yet
      </div>
    );
  }

  return (
    <div className="relative pl-8 space-y-4">
      <div className="timeline-rail" />
      {events.map((event) => {
        const Icon = eventIcons[event.event_type] || FileText;
        return (
          <div key={event.id} className="relative">
            <div className="absolute left-[-1.55rem] top-1">
              <div className="timeline-dot" />
            </div>
            <div className="rounded-lg border border-border bg-[hsl(var(--surface-2))] px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{event.title}</span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {timeAgo(event.created_at)}
                </span>
              </div>
              {event.description && (
                <div className="text-xs text-muted-foreground pl-5.5">
                  <p>{event.description}</p>
                  {event.metadata?.transcript_preview && (
                    <p className="mt-1 italic text-[10px] border-l-2 border-border pl-2 py-0.5">
                      "{event.metadata.transcript_preview}..."
                    </p>
                  )}
                  {event.metadata?.recording_url && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <audio controls className="h-8 w-full max-w-[240px]">
                        <source src={event.metadata.recording_url} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
