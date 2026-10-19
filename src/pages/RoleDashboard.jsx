import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Loader2, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { allowedWidgets } from '@/components/dashboard/widgetRegistry';
import { errorText } from '@/components/admin/userBits';
import { getRoleDashboard } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { roleLabel } from '@/lib/rbac';

/** The dashboard for the current role: only the widgets its permissions allow. */
export default function RoleDashboard() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRoleDashboard().then((r) => setData(r.data.widgets || {})).catch((e) => setError(errorText(e, 'Failed to load the dashboard')));
  }, []);

  const widgets = data ? allowedWidgets(can, undefined, data) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="role-dashboard">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><LayoutDashboard className="w-6 h-6 text-primary" /> Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{user ? `${user.name} · ${roleLabel(user.role)}` : ''}</p>
        </div>
        <Button asChild variant="outline"><Link to="/voice_agent"><PhoneCall className="w-4 h-4 mr-1" /> Voice Agent</Link></Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
      {data && widgets.map((widget) => <div key={widget.id} data-testid={`widget-${widget.id}`}>{widget.render(data[widget.group])}</div>)}
    </div>
  );
}
