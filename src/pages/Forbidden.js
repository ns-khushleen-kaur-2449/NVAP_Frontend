import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-3 px-6" data-testid="forbidden-page">
      <ShieldAlert className="w-10 h-10 text-muted-foreground" />
      <h1 className="font-display text-2xl font-semibold">You don't have access to this page</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Your role doesn't include this area. If you think it should, ask your administrator.
      </p>
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}
