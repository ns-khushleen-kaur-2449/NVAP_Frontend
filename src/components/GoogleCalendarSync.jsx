import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, AlertCircle, Loader2, Unlink } from 'lucide-react';
import { getGoogleAuthStatus, getGoogleAuthAuthorize, disconnectGoogleAuth } from '@/lib/api';

export default function GoogleCalendarSync() {
  const [connected, setConnected] = useState(false);
  const [scope, setScope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // 1. Check URL parameters for OAuth redirect status
    const params = new URLSearchParams(window.location.search);
    const calendarConnected = params.get('calendar_connected');
    const calendarError = params.get('calendar_error');

    if (calendarConnected === 'true') {
      toast.success('Successfully connected to Google Calendar!');
      cleanUrlParams();
    } else if (calendarError === 'true') {
      toast.error('Failed to connect to Google Calendar. Please try again.');
      cleanUrlParams();
    }

    // 2. Fetch current status
    fetchStatus();
  }, []);

  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('calendar_connected');
    url.searchParams.delete('calendar_error');
    window.history.replaceState({}, document.title, url.pathname + url.search);
  };

  const fetchStatus = async () => {
    try {
      const res = await getGoogleAuthStatus();
      setConnected(res.data.connected);
      setScope(res.data.scope);
    } catch (e) {
      console.error('Failed to fetch Google Calendar connection status:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res = await getGoogleAuthAuthorize();
      if (res.data && res.data.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error('Failed to get authorization URL');
        setActionLoading(false);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start authorization flow');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Calendar?')) {
      return;
    }
    setActionLoading(true);
    try {
      await disconnectGoogleAuth();
      setConnected(false);
      setScope(null);
      toast.success('Google Calendar disconnected successfully');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to disconnect Google Calendar');
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

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Google Calendar Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-2 rounded-lg border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-400">Connected</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Your primary calendar is connected. Events and meeting requests will automatically sync.
                </p>
              </div>
            </div>
            
            {scope && (
              <div className="text-xs text-muted-foreground bg-[hsl(var(--surface-2))] p-2.5 rounded border border-border">
                <span className="font-semibold block mb-0.5">Granted Scopes:</span>
                <code className="break-all font-mono text-[10px] text-primary">{scope}</code>
              </div>
            )}

            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="w-full sm:w-auto"
            >
              {actionLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Disconnecting...</>
              ) : (
                <><Unlink className="w-4 h-4 mr-2" /> Disconnect Calendar</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect your personal Google Calendar to enable meeting scheduling. Once authorized, the platform can automatically schedule video calls, create calendar events, and check availability.
            </p>
            <Button
              onClick={handleConnect}
              disabled={actionLoading}
              className="ai-btn-glow bg-primary text-primary-foreground hover:bg-[hsl(173_80%_32%)] w-full sm:w-auto"
            >
              {actionLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing...</>
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
