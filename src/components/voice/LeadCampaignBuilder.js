import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { 
  PhoneCall, Users, Search, Play, CheckCircle2, Filter, ChevronDown, 
  X, Calendar, IndianRupee, Clock,
  ArrowUpDown, UserPlus, Sparkles, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, timeAgo } from '../../lib/utils';
import { StageBadge } from '../shared/StatusBadges';
import CampaignLaunchDialog from './CampaignLaunchDialog';
import AddLeadDialog from './AddLeadDialog';
import ImportLeadsDialog from './ImportLeadsDialog';
import AiFilterPickerDialog from './AiFilterPickerDialog';
import { activeLabel, applyLeadFilters, buildLeadFilters, detailField, detailValue } from '../../lib/leadFilters';

const CALL_ATTEMPT_OPTIONS = [
  { value: 'never', label: 'Never called' },
  { value: 'recent', label: 'Within 30 days' },
  { value: 'old', label: 'More than 30 days ago' },
];

const DATE_ADDED_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Last 24h' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
];

// When a lead was added, in ms; null when the date is missing or unreadable.
const addedAt = (lead) => {
  const time = lead?.created_at ? new Date(lead.created_at).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
};

/** Sort by date added (`direction` -1 newest first, 1 oldest first); undated leads go last, ties by name. */
export function compareAdded(a, b, direction) {
  const left = addedAt(a);
  const right = addedAt(b);
  if (left !== right) {
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  }
  return (a.name || '').localeCompare(b.name || '');
}

// `canCreateCampaigns` mirrors the backend's campaign-creation roles; it only hides controls.
// `fromProspecting` ([{ id, name, phone, email, city, stage, created_at }]) are prospects ticked on
// the Prospecting page. They are added to the table (many are not leads yet, so the leads list
// lacks them) and ticked. `onFromProspectingDone(ids)` drops those ids (all of them without ids).
export default function LeadCampaignBuilder({
  onCampaignStarted, onLeadCreated, leads: leadList = [], assistants = [], loading = false, canCreateCampaigns = true,
  fromProspecting = null, onFromProspectingDone,
}) {
  // The table: picked prospects first (those not already listed), then the leads.
  const leads = useMemo(() => {
    if (!fromProspecting?.length) return leadList;
    const listed = new Set(leadList.map((lead) => lead.id));
    const extra = fromProspecting.filter((p) => !listed.has(p.id)).map((p) => ({
      id: p.id, name: p.name || '', phone: p.phone || '', email: p.email || '', city: p.city || '',
      stage: (p.stage || '').toLowerCase(), status: 'prospect', created_at: p.created_at, from_prospecting: true,
    }));
    return [...extra, ...leadList];
  }, [leadList, fromProspecting]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  // Campaign name, purpose, assistant and timing are filled in the launch dialog.
  const [launchOpen, setLaunchOpen] = useState(false);
  // Prospects picked in "Import from AI Filtering"; while set, the launch dialog uses them
  // instead of the leads ticked in the table below.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importedIds, setImportedIds] = useState(null);

  // Built from the leads: only filters the data can narrow by (see lib/leadFilters).
  const leadFilters = useMemo(() => buildLeadFilters(leads), [leads]);
  const [active, setActive] = useState({});
  const [dateAdded, setDateAdded] = useState('all');
  const [lastCall, setLastCall] = useState('all');
  // Offered only when some lead has a recorded call attempt.
  const hasCallAttempts = useMemo(() => leads.some((l) => l.last_retry_at), [leads]);
  const detail = useMemo(() => detailField(leads), [leads]);

  const setChoice = (key, value) => setActive((prev) => {
    const next = { ...prev };
    if (value === undefined || value === 'all') delete next[key];
    else next[key] = value;
    return next;
  });
  const setRange = (key, bound, value) => setActive((prev) => {
    const range = { ...(prev[key] || {}), [bound]: value };
    const next = { ...prev, [key]: range };
    if ((range.min === '' || range.min == null) && (range.max === '' || range.max == null)) delete next[key];
    return next;
  });

  const activeFiltersCount = Object.keys(active).length + (dateAdded !== 'all' ? 1 : 0) + (lastCall !== 'all' ? 1 : 0);
  // The first choice filters also sit in the bar; every filter is in "All filters".
  const quickFilters = leadFilters.filter((f) => f.kind === 'choice').slice(0, 3);

  const filteredLeads = useMemo(() => {
    let result = applyLeadFilters(leads, leadFilters, active);

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(lowerQ) ||
          l.email?.toLowerCase().includes(lowerQ) ||
          l.phone?.toLowerCase().includes(lowerQ)
      );
    }

    if (dateAdded !== 'all') {
      const now = new Date();
      result = result.filter(l => {
        const diffDays = (now - new Date(l.created_at)) / (1000 * 60 * 60 * 24);
        if (dateAdded === 'today') return diffDays <= 1;
        if (dateAdded === 'week') return diffDays <= 7;
        if (dateAdded === 'month') return diffDays <= 30;
        return true;
      });
    }

    if (lastCall !== 'all') {
      result = result.filter(l => {
        if (lastCall === 'never') return !l.last_retry_at;
        if (!l.last_retry_at) return false;
        const diffDays = (new Date() - new Date(l.last_retry_at)) / (1000 * 60 * 60 * 24);
        return lastCall === 'recent' ? diffDays <= 30 : diffDays > 30;
      });
    }

    if (sortBy === 'newest' || sortBy === 'oldest') {
      const direction = sortBy === 'newest' ? -1 : 1;
      result = [...result].sort((a, b) => compareAdded(a, b, direction));
    }

    return result;
  }, [leads, leadFilters, active, searchQuery, dateAdded, lastCall, sortBy]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId, checked) => {
    const next = new Set(selectedLeads);
    if (checked) {
      next.add(leadId);
    } else {
      next.delete(leadId);
    }
    setSelectedLeads(next);
  };

  const openLaunch = () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead.');
      return;
    }
    setLaunchOpen(true);
  };

  const handleCreated = (campaign) => {
    if (importedIds) setImportedIds(null);
    else {
      // Picked prospects that were launched are done; unticked ones stay for later.
      const launched = Array.from(selectedLeads);
      setSelectedLeads(new Set());
      if (fromProspecting?.length) onFromProspectingDone?.(launched.filter((id) => pickedIds.includes(id)));
    }
    onCampaignStarted?.(campaign);
  };

  const pickedIds = useMemo(() => (fromProspecting || []).map((p) => p.id), [fromProspecting]);
  // A new hand-off ticks its prospects (keeping anything already ticked).
  // Picked prospects are ticked when the page opens and when more arrive; unticking one sticks.
  const seenPicks = React.useRef(null);
  useEffect(() => {
    const seen = seenPicks.current;
    seenPicks.current = new Set(pickedIds);
    const fresh = seen ? pickedIds.filter((id) => !seen.has(id)) : pickedIds;
    if (fresh.length) setSelectedLeads((current) => new Set([...current, ...fresh]));
  }, [pickedIds]);
  const discardPicked = () => {
    setSelectedLeads((current) => new Set([...current].filter((id) => !pickedIds.includes(id))));
    onFromProspectingDone?.(pickedIds);
  };

  const launchImported = (ids) => {
    setPickerOpen(false);
    setImportedIds(ids);
    setLaunchOpen(true);
  };

  const changeLaunchOpen = (open) => {
    setLaunchOpen(open);
    // Closing without launching drops the imported prospects; the table's ticks are kept.
    if (!open) setImportedIds(null);
  };

  const resetFilters = () => {
    setActive({});
    setDateAdded('all');
    setLastCall('all');
  };

  return (
    <Card className="border border-border shadow-sm flex flex-col h-full bg-card rounded-xl overflow-visible">
      <CardContent className="flex-1 flex flex-col min-h-0 p-0 overflow-visible">
        {fromProspecting?.length > 0 && (
          <div className="px-4 py-3 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-primary/5"
            role="region" aria-label="Prospects from Prospecting">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                {pickedIds.length.toLocaleString()} prospect{pickedIds.length === 1 ? '' : 's'} added from Prospecting
              </p>
              <p className="text-xs text-muted-foreground">They are in the list below, ticked and ready to launch (marked “From Prospecting”).</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to="/prospecting">Back to Prospecting</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={discardPicked}>Remove them</Button>
            </div>
          </div>
        )}

        {/* Filters Top Bar */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between overflow-x-auto no-scrollbar bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Filters:
            </span>
            
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`h-8 gap-2 rounded-full border-border ${activeFiltersCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                >
                  All filters {activeFiltersCount > 0 && <Badge className="h-4 min-w-[16px] px-1 bg-blue-600 text-[10px]">{activeFiltersCount}</Badge>}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[580px] max-w-[90vw] p-4 bg-card border border-border shadow-xl rounded-xl z-50 animate-in fade-in zoom-in-95 duration-150" align="start" sideOffset={8}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wide">All Lead Filters</h3>
                    <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-muted-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3.5 gap-x-4 max-h-[60vh] overflow-y-auto pr-1">
                    {leadFilters.map((filter) => (
                      <div key={filter.key} className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{filter.label}</label>
                        {filter.kind === 'choice' ? (
                          <Select value={active[filter.key] ?? 'all'} onValueChange={(v) => setChoice(filter.key, v)}>
                            <SelectTrigger className="h-8.5 bg-card border-border text-xs" aria-label={filter.label}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Any</SelectItem>
                              {filter.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label} ({option.count})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Input type="number" inputMode="numeric" aria-label={`${filter.label} from`} placeholder={String(filter.min)}
                              className="h-8.5 bg-card border-border text-xs" value={active[filter.key]?.min ?? ''}
                              onChange={(e) => setRange(filter.key, 'min', e.target.value)} />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input type="number" inputMode="numeric" aria-label={`${filter.label} to`} placeholder={String(filter.max)}
                              className="h-8.5 bg-card border-border text-xs" value={active[filter.key]?.max ?? ''}
                              onChange={(e) => setRange(filter.key, 'max', e.target.value)} />
                          </div>
                        )}
                      </div>
                    ))}

                    {hasCallAttempts && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last call attempt</label>
                        <Select value={lastCall} onValueChange={setLastCall}>
                          <SelectTrigger className="h-8.5 bg-card border-border text-xs" aria-label="Last call attempt">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any time</SelectItem>
                            {CALL_ATTEMPT_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date added</label>
                      <Select value={dateAdded} onValueChange={setDateAdded}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs" aria-label="Date added">
                          <div className="flex items-center gap-1.5">
                             <Calendar className="w-3.5 h-3.5 text-orange-500" />
                             <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_ADDED_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-border">
                    <Button variant="ghost" size="sm" className="text-muted-foreground font-medium text-xs h-8" onClick={resetFilters}>Clear all</Button>
                    <Button size="sm" className="bg-[#F87217] hover:bg-[#232e60] text-white font-semibold text-xs h-8 px-4 rounded-md shadow-sm" onClick={() => setShowFilters(false)}>Apply filters</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {quickFilters.map((filter) => (
              <Select key={filter.key} value={active[filter.key] ?? 'all'} onValueChange={(v) => setChoice(filter.key, v)}>
                <SelectTrigger aria-label={`Quick filter: ${filter.label}`}
                  className={`h-8 w-auto min-w-[110px] max-w-[180px] rounded-full text-xs font-medium focus:ring-0 ${active[filter.key] ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'border-border text-muted-foreground'}`}>
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {filter.label.toLowerCase()}</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label} ({option.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>

          <Badge variant="secondary" className="px-3 py-1 font-medium bg-[#F87217]/8 text-[#F87217] border border-[#F87217]/20 shrink-0">
            {selectedLeads.size} Selected
          </Badge>
        </div>

        {/* Active Filter Tags */}
        {activeFiltersCount > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap bg-muted/50">
            {leadFilters.filter((filter) => active[filter.key] !== undefined).map((filter) => (
              <Badge key={filter.key} variant="secondary" className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 font-medium px-2 py-0.5 text-[11px]">
                {activeLabel(filter, active[filter.key])}
                <button type="button" aria-label={`Remove filter ${filter.label}`} onClick={() => setChoice(filter.key)}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            {dateAdded !== 'all' && (
              <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 font-medium px-2 py-0.5 text-[11px]">
                {DATE_ADDED_OPTIONS.find((o) => o.value === dateAdded)?.label}
                <button type="button" aria-label="Remove filter Date added" onClick={() => setDateAdded('all')}><X className="w-3 h-3" /></button>
              </Badge>
            )}
            {lastCall !== 'all' && (
              <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 font-medium px-2 py-0.5 text-[11px]">
                {CALL_ATTEMPT_OPTIONS.find((o) => o.value === lastCall)?.label}
                <button type="button" aria-label="Remove filter Last call attempt" onClick={() => setLastCall('all')}><X className="w-3 h-3" /></button>
              </Badge>
            )}
            <button className="text-[11px] text-muted-foreground hover:text-foreground/80 font-medium ml-1" onClick={resetFilters}>Clear all</button>
          </div>
        )}

        {/* Search and Sort */}
        <div className="px-4 py-2.5 flex items-center gap-4 bg-card border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, or phone..."
              className="pl-9 w-full h-9 rounded-lg border-border bg-card text-sm focus:ring-1 focus:ring-blue-100"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
             <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
             <Select value={sortBy} onValueChange={setSortBy}>
               <SelectTrigger className="h-9 w-[160px] border-border text-sm">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="newest">Sort: Newest first</SelectItem>
                 <SelectItem value="oldest">Sort: Oldest first</SelectItem>
               </SelectContent>
             </Select>
             <Button
               size="sm"
               variant="outline"
               onClick={() => setPickerOpen(true)}
               disabled={!canCreateCampaigns}
               className="h-9 gap-1.5"
             >
               <Sparkles className="w-3.5 h-3.5" />
               Import from AI Filtering
             </Button>
             <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="h-9 gap-1.5">
               <Upload className="w-3.5 h-3.5" />
               Import leads
             </Button>
             <Button
               size="sm"
               onClick={() => setAddLeadOpen(true)}
               className="h-9 bg-[#F87217] hover:bg-[#F87217]/90 text-white gap-1.5"
             >
               <UserPlus className="w-3.5 h-3.5" />
               Add Lead
             </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-card">
          <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-4 shrink-0">
            <Checkbox 
              checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
            <div className="grid grid-cols-12 w-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <div className="col-span-4 pl-1">Lead Name</div>
              <div className="col-span-3">Contact</div>
              <div className="col-span-3">{detail ? detail.label : 'City'}</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <div className="animate-pulse w-8 h-8 rounded-full bg-[#F87217]/10 mb-3"></div>
                <p>Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground h-full flex items-center justify-center">
                <p>No leads found matching your criteria.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <div 
                    key={lead.id} 
                    className={`px-4 py-2.5 flex items-center gap-4 transition-colors hover:bg-muted border-b border-border last:border-0 ${selectedLeads.has(lead.id) ? 'bg-blue-50/40' : 'bg-card'}`}
                  >
                    <Checkbox 
                      checked={selectedLeads.has(lead.id)}
                      onCheckedChange={(checked) => handleSelectLead(lead.id, checked)}
                    />
                    <div className="grid grid-cols-12 w-full items-center text-sm">
                      <div className="col-span-4 pl-1">
                        {/* Opens the lead (details, edit, timeline); Back on /leads returns here. */}
                        <Link to={`/leads?prospect=${encodeURIComponent(lead.id)}`} title="Open this lead"
                          className="block font-semibold text-foreground truncate hover:text-primary hover:underline">
                          {lead.name || 'Unnamed'}
                        </Link>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {lead.created_at && <span>Added {timeAgo(lead.created_at)}</span>}
                          {lead.from_prospecting && <Badge variant="outline" className="h-4 px-1 text-[9px]">From Prospecting</Badge>}
                        </div>
                      </div>
                      <div className="col-span-3 text-muted-foreground truncate">
                        <div className="text-xs font-medium">{lead.phone || '-'}</div>
                      </div>
                      <div className="col-span-3">
                         {detailValue(lead, detail) ? (
                           <Badge variant="outline" className="font-medium bg-purple-50 text-purple-700 border-purple-100 text-[10px] px-2 py-0 max-w-full truncate">
                             {detailValue(lead, detail)}
                           </Badge>
                         ) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                      <div className="col-span-2 text-right">
                        <StageBadge stage={lead.stage} className="text-[10px] uppercase tracking-tighter" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
      
      <CardFooter className="pt-1.5 pb-2.5 flex-col gap-1">
        {!canCreateCampaigns && (
          <p className="text-xs text-muted-foreground">Campaigns are created by Tenant Admins, Managers and Sales Reps.</p>
        )}
        <Button
          className="w-full h-10 gap-2 bg-[#F87217] hover:bg-[#C2560E] text-white rounded-xl text-xs font-semibold transition-all duration-200 shadow-lg shadow-blue-900/10 active:scale-[0.98]"
          size="sm"
          onClick={openLaunch}
          disabled={selectedLeads.size === 0 || !canCreateCampaigns}
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Launch Campaign for {selectedLeads.size} Lead{selectedLeads.size !== 1 && 's'}
        </Button>
      </CardFooter>
      <CampaignLaunchDialog
        open={launchOpen}
        onOpenChange={changeLaunchOpen}
        source={{ type: 'leads', prospectIds: importedIds || Array.from(selectedLeads) }}
        assistants={assistants}
        onCreated={handleCreated}
      />

      <AiFilterPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={launchImported}
      />

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={async (result) => {
          // The new leads appear in the list (refreshed) and are ticked, ready to launch.
          await onLeadCreated?.();
          const ids = result?.prospect_ids || [];
          if (ids.length) setSelectedLeads((current) => new Set([...current, ...ids]));
        }}
      />

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        onCreated={onLeadCreated}
      />
    </Card>
  );
}
