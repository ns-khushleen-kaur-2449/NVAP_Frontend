import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare, Phone, PhoneCall, ArrowLeft, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { path: '/voice_agent', label: 'Voice Agent', icon: PhoneCall,     roles: ['agent', 'manager', 'admin'] },
];

const navLinkClass = (isActive, collapsed) => cn(
  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
  isActive
    ? 'bg-[#F87217]/10 text-[#F87217] border border-[#F87217]/30'
    : 'text-gray-600 hover:text-gray-900 hover:bg-[#F87217]/8',
  collapsed && 'justify-center px-2'
);

const iconClass = (isActive) => cn(
  'h-4 w-4 shrink-0 transition-colors',
  isActive ? 'text-[#F87217]' : 'text-gray-400 group-hover:text-gray-600'
);

export const VoiceSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const visible = (roles) => !user || roles.includes(user.role);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-[#F87217]/15 bg-[#F87217]/5 transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-[272px]'
        )}
      >
        {/* Header section with Back button */}
        <div className="flex flex-col border-b border-[#F87217]/15">
          <button
            onClick={() => navigate('/dashboard')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm text-gray-500 hover:text-gray-900 hover:bg-[#F87217]/8 transition-colors border-b border-[#F87217]/15",
              collapsed && "justify-center"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            {!collapsed && <span>Back to Home</span>}
          </button>
          <div className="flex items-center gap-3 px-4 py-5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#F87217]/15 flex-shrink-0">
              <PhoneCall className="w-5 h-5 text-[#F87217]" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-display text-lg font-semibold tracking-tight text-gray-900">Voice Agent</h1>
                <p className="text-[10px] text-[#F87217]/80 tracking-wider uppercase">AI Operations</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter(item => visible(item.roles)).map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;

              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={navLinkClass(isActive, collapsed)}
                >
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>
        </ScrollArea>

        {/* User info + logout */}
        {user && (
          <div className={cn("border-t border-[#F87217]/15 p-3", collapsed && "px-2")}>
            {!collapsed && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#F87217]/15 flex items-center justify-center text-[#F87217] text-xs font-semibold flex-shrink-0">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-gray-900">{user.name}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-[#F87217]/8 transition-colors",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  {!collapsed && <span>Logout</span>}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Logout</TooltipContent>}
            </Tooltip>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-[#F87217]/15 text-gray-400 hover:text-gray-700 hover:bg-[#F87217]/8 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
};
