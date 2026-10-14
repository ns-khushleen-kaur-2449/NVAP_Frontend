import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, AlertTriangle, Loader2, Unlink, RefreshCw, Star } from 'lucide-react';
import {
  getCalendarProviders,
  getCalendarConnections,
  startCalendarConnect,
  completeCalendarOAuth,
  disconnectCalendarConnection,
  setPrimaryCalendarConnection,
  listConnectionCalendars,
  setBookingCalendar,
} from '@/lib/api';

// Every account type connects through Nylas; `provider` is the account behind the connection.
const ACCOUNT_LABELS = { google: 'Google', microsoft: 'Microsoft 365 / Outlook', icloud: 'iCloud' };
const OAUTH_PARAMS = ['status', 'error', 'connection_id', 'provider', 'code', 'state'];

const label = (provider) => ACCOUNT_LABELS[provider] || provider;

const errorDetail = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

const cleanOAuthParams = () => {
  const url = new URL(window.location.href);
  OAUTH_PARAMS.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, url.pathname + url.search);
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : null);

function StatusBadge({ status }) {
  if (status === 'connected') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
      </Badge>
    );
  }
  if (status === 'pending') {
    return <Badge variant="outline" className="text-amber-700 dark:text-amber-400">Choose a calendar</Badge>;
  }
  if (status === 'reauth_required') {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/10">
        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Reconnect needed
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-muted-foreground">Disconnected</Badge>;
}

/** Pick where bookings go; required before an iCloud connection can be used. */
function BookingCalendarPicker({ connection, onChanged }) {
  const [calendars, setCalendars] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listConnectionCalendars(connection.id)
      .then((res) => setCalendars(res.data || []))
      .catch((e) => toast.error(errorDetail(e, 'Failed to load calendars')));
  }, [connection.id]);

  if (!calendars) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  const current = calendars.find((c) => c.is_booking_calendar)?.id;

  const choose = async (calendarId) => {
    setSaving(true);
    try {
      await setBookingCalendar(connection.id, calendarId);
      toast.success('Booking calendar saved');
      await onChanged();
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to save the booking calendar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Meetings and scheduled campaigns are added to</p>
      <Select value={current} onValueChange={choose} disabled={saving}>
        <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Choose a calendar" /></SelectTrigger>
        <SelectContent>
          {calendars.map((c) => (
            <SelectItem key={c.id} value={c.id} disabled={c.read_only}>
              {c.name || c.id}{c.is_primary ? ' (primary)' : ''}{c.read_only ? ' — read-only' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Calendar accounts (Google, Microsoft, iCloud), all connected through Nylas. */
export default function CalendarConnections() {
  const [connections, setConnections] = useState([]);
  const [providers, setProviders] = useState(Object.keys(ACCOUNT_LABELS));
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const handledRedirect = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [providersRes, connectionsRes] = await Promise.all([
        getCalendarProviders().catch(() => null),
        getCalendarConnections(),
      ]);
      const details = providersRes?.data?.details;
      if (details?.length) {
        setProviders(details.map((p) => p.name));
        setConfigured(details.some((p) => p.configured));
      }
      setConnections(connectionsRes.data || []);
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to load calendar connections'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // StrictMode runs effects twice; an OAuth code can only be exchanged once.
    if (handledRedirect.current) return;
    handledRedirect.current = true;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const code = params.get('code');
    const state = params.get('state');

    const handleRedirect = async () => {
      if (status === 'connected') {
        toast.success(`${label(params.get('provider'))} calendar connected`);
      } else if (status === 'error') {
        toast.error(params.get('error') || 'Failed to connect the calendar');
      } else if (code && state) {
        // Nylas redirected straight to this page: finish the exchange via the API.
        try {
          await completeCalendarOAuth({ code, state, redirect_uri: window.location.origin + window.location.pathname });
          toast.success('Calendar connected');
        } catch (e) {
          toast.error(errorDetail(e, 'Failed to connect the calendar'));
        }
      } else if (params.get('error')) {
        toast.error(`Authorization was not completed: ${params.get('error')}`);
      }
      if (status || code || params.get('error')) cleanOAuthParams();
      await fetchStatus();
    };

    handleRedirect();
  }, [fetchStatus]);

  const run = async (key, action) => {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  const connect = (provider) => run(`connect-${provider}`, async () => {
    try {
      const res = await startCalendarConnect(provider);
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
        return;
      }
      toast.error('Failed to get authorization URL');
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to start authorization'));
    }
  });

  const disconnect = (connection) => run(connection.id, async () => {
    const name = `${label(connection.provider)} calendar`;
    if (!window.confirm(`Disconnect your ${name}?`)) return;
    try {
      await disconnectCalendarConnection(connection.id);
      toast.success(`${name} disconnected`);
    } catch (e) {
      if (e?.response?.status === 502 && window.confirm('The calendar service could not be reached. Disconnect anyway?')) {
        try {
          await disconnectCalendarConnection(connection.id, true);
          toast.success(`${name} disconnected`);
        } catch (err) {
          toast.error(errorDetail(err, 'Failed to disconnect'));
        }
      } else {
        toast.error(errorDetail(e, 'Failed to disconnect'));
      }
    }
    await fetchStatus();
  });

  const makePrimary = (connection) => run(connection.id, async () => {
    try {
      await setPrimaryCalendarConnection(connection.id);
      await fetchStatus();
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to set the primary calendar'));
    }
  });

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Checking calendar connections...</span>
        </CardContent>
      </Card>
    );
  }

  const active = connections.filter((c) => c.status !== 'disconnected');
  const connectedProviders = new Set(active.map((c) => c.provider));
  const available = providers.filter((p) => !connectedProviders.has(p));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Calendar
        </CardTitle>
        {!active.length && <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {active.map((connection) => (
          <div key={connection.id} className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {label(connection.provider)}
                  {connection.is_primary && <Star className="w-3.5 h-3.5 text-primary fill-current" aria-label="Primary" />}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection.email || 'Unknown account'}
                  {connection.connected_at ? ` · connected ${formatDate(connection.connected_at)}` : ''}
                </p>
              </div>
              <StatusBadge status={connection.status} />
            </div>

            {connection.status === 'reauth_required' && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Access has expired or was revoked. Reconnect to keep scheduling working.
              </p>
            )}
            {['connected', 'pending'].includes(connection.status) && (
              <BookingCalendarPicker connection={connection} onChanged={fetchStatus} />
            )}

            <div className="flex flex-wrap gap-2">
              {connection.status === 'reauth_required' && (
                <Button size="sm" onClick={() => connect(connection.provider)} disabled={!!busy}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Reconnect
                </Button>
              )}
              {connection.status === 'connected' && !connection.is_primary && (
                <Button size="sm" variant="outline" onClick={() => makePrimary(connection)} disabled={!!busy}>
                  <Star className="w-4 h-4 mr-2" /> Make primary
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => disconnect(connection)} disabled={!!busy}>
                {busy === connection.id
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Working...</>
                  : <><Unlink className="w-4 h-4 mr-2" /> Disconnect</>}
              </Button>
            </div>
          </div>
        ))}

        {!active.length && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Connect your calendar so the platform can schedule meetings, create calendar events, and check your availability.
            Sign in with the account for your login email.
          </p>
        )}
        {!configured && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Calendar connections are not configured on the server yet. Ask an administrator to set the Nylas credentials.
          </p>
        )}
        {available.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {available.map((provider) => (
              <Button
                key={provider}
                variant={active.length ? 'outline' : 'default'}
                onClick={() => connect(provider)}
                disabled={!!busy || !configured}
              >
                {busy === `connect-${provider}`
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</>
                  : <><Calendar className="w-4 h-4 mr-2" /> Connect {label(provider)}</>}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
