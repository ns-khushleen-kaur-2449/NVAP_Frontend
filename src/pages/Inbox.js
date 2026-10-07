import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox as InboxIcon, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getInbox } from '@/lib/api';

export default function InboxPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInbox().then((r) => setMessages(r.data)).catch(() => setMessages([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <InboxIcon className="w-5 h-5 text-primary" /> Inbox
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Every AI-drafted message tied to a real prospect — approved and sent.</p>
      </div>

      <div className="space-y-2">
        {messages.map((m) => (
          <Card key={m.id} className="card-base p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{m.prospect?.name || m.prospect_name}</span>
                {m.prospect && <span className="text-xs text-muted-foreground">· {m.prospect.title}{m.prospect.company ? ` · ${m.prospect.company}` : ''}</span>}
              </div>
              <Badge variant={m.status === 'sent' ? 'default' : 'secondary'}>{m.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mb-1">{m.subject}</div>
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            {m.prospect_id && (
              <Link to="/prospecting" className="text-xs text-primary mt-2 inline-block underline">View prospect in Prospecting →</Link>
            )}
          </Card>
        ))}
        {!loading && messages.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            No messages yet. Approve and send messages from a campaign to see them here.
          </div>
        )}
      </div>
    </div>
  );
}
