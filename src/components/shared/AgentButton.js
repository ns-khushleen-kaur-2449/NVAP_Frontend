import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const AgentButton = ({
  onClick, loading, icon: Icon, children, variant = 'default', className, ...props
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={loading}
      variant={variant}
      className={cn(
        variant === 'default' && 'ai-btn-glow bg-primary text-primary-foreground hover:bg-[hsl(173_80%_32%)]',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 mr-2" />
      ) : null}
      {loading ? 'Running...' : children}
    </Button>
  );
};
