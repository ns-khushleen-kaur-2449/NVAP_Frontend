import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, AlertTriangle, Loader2, Unlink, RefreshCw } from 'lucide-react';
import {
  getCalendarProviders,
  getCalendarConnections,
  startCalendarConnect,
  completeCalendarOAuth,
  disconnectCalendarConnection,
} from '@/lib/api';

const PROVIDER = 'google';
const OAUTH_PARAMS = ['status', 'error', 'connection_id', 'provider', 'code', 'state', 'scope', 'authuser', 'prompt', 'hd'];

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

export default function GoogleCalendarSync() {
  const [connection, setConnection] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const handledRedirect = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [providersRes, connectionsRes] = await Promise.all([
        getCalendarProviders().catch(() => null),
        getCalendarConnections(),
      ]);
      const google = providersRes?.data?.details?.find((p) => p.name === PROVIDER);
      setConfigured(google ? google.configured : true);
      const googleConnections = (connectionsRes.data || []).filter((c) => c.provider === PROVIDER);
      setConnection(googleConnections.find((c) => c.is_primary) || googleConnections[0] || null);
    } catch (e) {
      console.error('Failed to fetch Google Calendar connection status:', e);
      toast.error(errorDetail(e, 'Failed to load Google Calendar status'));
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
        toast.success('Google Calendar connected');
      } else if (status === 'error') {
        toast.error(params.get('error') || 'Failed to connect Google Calendar');
      } else if (code && state) {
        // Google redirected straight to this page: finish the exchange via the API.
        try {
          await completeCalendarOAuth({
            code,
            state,
            provider: PROVIDER,
            redirect_uri: window.location.origin + window.location.pathname,
          });
          toast.success('Google Calendar connected');
        } catch (e) {
          toast.error(errorDetail(e, 'Failed to connect Google Calendar'));
        }
      } else if (params.get('error')) {
        toast.error(`Google authorization was not completed: ${params.get('error')}`);
      }
      if (status || code || params.get('error')) cleanOAuthParams();
      await fetchStatus();
    };

    handleRedirect();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res = await startCalendarConnect(PROVIDER);
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
        return;
      }
      toast.error('Failed to get authorization URL');
    } catch (e) {
      toast.error(errorDetail(e, 'Failed to start authorization flow'));
    }
    setActionLoading(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!window.confirm('Are you sure you want to disconnect your Google Calendar?')) return;
    setActionLoading(true);
    try {
      await disconnectCalendarConnection(connection.id);
      toast.success('Google Calendar disconnected');
      await fetchStatus();
    } catch (e) {
      if (e?.response?.status === 502 &&
          window.confirm('Google could not be reached to revoke access. Remove the connection anyway?')) {
        try {
          await disconnectCalendarConnection(connection.id, true);
          toast.success('Google Calendar disconnected');
          await fetchStatus();
        } catch (err) {
          toast.error(errorDetail(err, 'Failed to disconnect Google Calendar'));
        }
      } else {
        toast.error(errorDetail(e, 'Failed to disconnect Google Calendar'));
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Checking Google Calendar status...</span>
        </CardContent>
      </Card>
    );
  }

  const isConnected = connection?.status === 'connected';
  const needsReauth = connection?.status === 'reauth_required';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Google Calendar
        </CardTitle>
        {isConnected && (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
          </Badge>
        )}
        {needsReauth && (
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/10">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Reconnect needed
          </Badge>
        )}
        {!connection && <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <div className="space-y-4">
            {isConnected ? (
              <div className="flex items-start gap-2 text-sm bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-2 rounded-lg border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-400">
                    Connected{connection.email ? ` as ${connection.email}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The platform can create events and check your availability.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-400">
                    Access to {connection.email || 'your calendar'} has expired or was revoked
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Reconnect to keep scheduling working.</p>
                </div>
              </div>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {connection.display_name && (
                <div>
                  <dt className="text-muted-foreground">Account name</dt>
                  <dd className="font-medium">{connection.display_name}</dd>
                </div>
              )}
              {connection.connected_at && (
                <div>
                  <dt className="text-muted-foreground">Connected on</dt>
                  <dd className="font-medium">{formatDate(connection.connected_at)}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-wrap gap-2">
              {needsReauth && (
                <Button onClick={handleConnect} disabled={actionLoading} className="bg-primary text-primary-foreground">
                  <RefreshCw className="w-4 h-4 mr-2" /> Reconnect
                </Button>
              )}
              <Button variant="destructive" onClick={handleDisconnect} disabled={actionLoading}>
                {actionLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Working...</>
                ) : (
                  <><Unlink className="w-4 h-4 mr-2" /> Disconnect</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect your Google Calendar so the platform can schedule meetings, create calendar events, and check your availability.
            </p>
            {!configured && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Google Calendar is not configured on the server yet. Ask an administrator to set the Google OAuth credentials.
              </p>
            )}
            <Button
              onClick={handleConnect}
              disabled={actionLoading || !configured}
              className="ai-btn-glow bg-primary text-primary-foreground hover:bg-[hsl(173_80%_32%)] w-full sm:w-auto"
            >
              {actionLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to Google...</>
              ) : (
                <><Calendar className="w-4 h-4 mr-2" /> Connect Google Calendar</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
