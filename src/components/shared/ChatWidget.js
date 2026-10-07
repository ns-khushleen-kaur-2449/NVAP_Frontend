import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getKbs, getActiveKb, askChatbot } from '@/lib/api';

/**
 * Global floating chat launcher + panel. Talks to the RAG chatbot service
 * (chatbot/app) mounted at the backend root (/kb, /askgroq, ...).
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [kbs, setKbs] = useState([]);
  const [activeKb, setActiveKb] = useState(null);
  const [selectedKb, setSelectedKb] = useState('');
  const [messages, setMessages] = useState([
    { author_type: 'bot', text: "Hi! I'm ROCKET 🚀. Ask me anything about our services." },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!open || kbs.length > 0) return;
    (async () => {
      try {
        const [kbRes, activeRes] = await Promise.all([getKbs(), getActiveKb()]);
        setKbs(kbRes.data?.kbs || []);
        const active = activeRes.data?.active_kb || kbRes.data?.active_kb || '';
        setActiveKb(active);
        setSelectedKb(active || kbRes.data?.kbs?.[0]?.name || '');
      } catch (e) {
        console.error('Failed to load knowledge bases', e);
      }
    })();
  }, [open, kbs.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || thinking) return;

    const history = messages.map((m) => ({
      author_type: m.author_type,
      text: m.text,
    }));

    setMessages((prev) => [...prev, { author_type: 'user', text: query }]);
    setInput('');
    setThinking(true);

    try {
      const res = await askChatbot(query, selectedKb || activeKb, history);
      setMessages((prev) => [...prev, { author_type: 'bot', text: res.data?.answer || 'No response.' }]);
    } catch (e) {
      const detail = e.response?.data?.detail || 'Something went wrong. Please try again.';
      setMessages((prev) => [...prev, { author_type: 'bot', text: detail }]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Rocket chat' : 'Open Rocket, your SmartSDR guide'}
        animate={open ? {} : { y: [0, -6, 0], rotate: [0, -3, 3, 0] }}
        transition={{ y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
        whileHover={{ scale: 1.08 }}
        className="fixed bottom-6 right-6 z-[900] flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--surface-2))] shadow-[0_10px_30px_-6px_rgba(248,114,23,0.55)] ring-1 ring-border"
      >
        <span className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-md" />
        {open ? <X className="h-6 w-6 text-foreground" /> : <img src="/rocket.png" alt="Rocket" className="h-12 w-12 object-contain" />}
      </motion.button>

      <div
        className={cn(
          'fixed bottom-24 right-6 z-[899] flex h-[560px] max-h-[calc(100vh-140px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl transition-all duration-200',
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <div className="flex-shrink-0 border-b border-border bg-[hsl(var(--surface-2))] p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--surface-2))]">
              <img src="/rocket.png" alt="" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold">ROCKET🚀</div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-teal-500">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Online
              </div>
            </div>
          </div>
          {kbs.length > 0 && (
            <select
              value={selectedKb}
              onChange={(e) => setSelectedKb(e.target.value)}
              className="w-full rounded-md border border-border bg-[hsl(var(--surface-1))] px-2 py-1.5 text-xs outline-none"
            >
              {kbs.map((kb) => (
                <option key={kb.name} value={kb.name}>
                  {kb.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <ScrollArea className="flex-1 bg-background p-4">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.author_type === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    m.author_type === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border border-border bg-[hsl(var(--surface-2))] text-foreground'
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-[hsl(var(--surface-2))] px-3.5 py-2.5 text-xs text-muted-foreground w-fit">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 border-t border-border bg-[hsl(var(--surface-2))] p-3">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="flex-1"
              disabled={thinking}
            />
            <Button size="icon" onClick={sendMessage} disabled={thinking || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
