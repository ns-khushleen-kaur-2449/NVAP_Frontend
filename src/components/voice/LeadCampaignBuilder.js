import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  X, Calendar, MapPin, Building, Briefcase, IndianRupee, Clock,
  ArrowUpDown, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, timeAgo } from '../../lib/utils';
import { StageBadge } from '../shared/StatusBadges';
import CampaignLaunchDialog from './CampaignLaunchDialog';
import AddLeadDialog from './AddLeadDialog';

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'converted', label: 'Converted' },
];

const SOURCE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: '99acres', label: '99acres' },
  { value: 'magicbricks', label: 'MagicBricks' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'Google Ads', label: 'Google Ads' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Cold Call', label: 'Cold Call' },
];

const BUDGET_OPTIONS = [
  { value: 'any', label: 'Any budget' },
  { value: '0-50', label: '< 50L' },
  { value: '50-100', label: '50L - 1Cr' },
  { value: '100-200', label: '1Cr - 2Cr' },
  { value: '200+', label: '> 2Cr' },
];

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

const PROPERTY_TYPE_OPTIONS = [
  { value: '2BHK', label: '2 BHK' },
  { value: '3BHK', label: '3 BHK' },
  { value: '4BHK', label: '4 BHK' },
  { value: 'Plot', label: 'Plot' },
  { value: 'Villa', label: 'Villa' },
];

export default function LeadCampaignBuilder({ onCampaignStarted, onLeadCreated, leads = [], properties = [], assistants = [], loading = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  // Campaign name, purpose, assistant and timing are filled in the launch dialog.
  const [launchOpen, setLaunchOpen] = useState(false);

  const [filters, setFilters] = useState({
    stage: 'all',
    project: 'all',
    category: 'all',
    subCategory: 'all',
    source: 'all',
    assignedTo: 'all',
    budgetRange: 'any',
    lastCall: 'all',
    location: 'all',
    dateAdded: 'all',
    propertyType: 'all'
  });

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'budgetRange') return value !== 'any';
      return value !== 'all';
    }).length;
  }, [filters]);

  const projectList = useMemo(() => {
    const fromProps = properties.map(p => p.name);
    const fromLeads = leads.map(l => l.project).filter(Boolean);
    const fromModelLeads = leads.map(l => l.initial_project).filter(Boolean);
    const fromModelFinal = leads.map(l => l.final_project).filter(Boolean);
    const fromModelStandard = leads.map(l => l.project_standardized).filter(Boolean);
    
    return Array.from(new Set([
      ...fromProps, 
      ...fromLeads, 
      ...fromModelLeads, 
      ...fromModelFinal, 
      ...fromModelStandard
    ])).sort();
  }, [properties, leads]);

  const categoryList = useMemo(() => {
    const fromLeads = leads.map(l => l.category).filter(Boolean);
    return Array.from(new Set(fromLeads.map(v => String(v)))).sort();
  }, [leads]);

  const subCategoryList = useMemo(() => {
    const fromLeads = leads.map(l => l.sub_category).filter(Boolean);
    return Array.from(new Set(fromLeads.map(v => String(v)))).sort();
  }, [leads]);

  const sourceList = useMemo(() => {
    const fromLeads = leads.map(l => l.lead_source || l.source).filter(Boolean);
    return Array.from(new Set(fromLeads.map(v => String(v)))).sort();
  }, [leads]);

  const ownerList = useMemo(() => {
    const fromLeads = leads.map(l => l.lead_owner || l.assigned_to).filter(Boolean);
    return Array.from(new Set(fromLeads.map(v => String(v)))).sort();
  }, [leads]);

  const budgetRangeList = useMemo(() => {
    const fromLeads = leads.map(l => l.budget_range).filter(Boolean);
    return Array.from(new Set(fromLeads.map(v => String(v)))).sort();
  }, [leads]);

  const stageList = useMemo(() => {
    const fromLeads = leads.map(l => l.lead_stage || l.lead_status || l.stage).filter(Boolean);
    return Array.from(new Set(fromLeads.map(v => String(v)))).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(lowerQ) ||
          l.email?.toLowerCase().includes(lowerQ) ||
          l.phone?.toLowerCase().includes(lowerQ)
      );
    }

    // Filter by Stage
    if (filters.stage !== 'all') {
      result = result.filter(l => 
        String(l.stage).toLowerCase() === filters.stage.toLowerCase() || 
        String(l.lead_stage).toLowerCase() === filters.stage.toLowerCase() || 
        String(l.lead_status).toLowerCase() === filters.stage.toLowerCase()
      );
    }

    // Filter by Source
    if (filters.source !== 'all') {
      result = result.filter(l => 
        String(l.source).toLowerCase() === filters.source.toLowerCase() || 
        String(l.lead_source).toLowerCase() === filters.source.toLowerCase()
      );
    }

    // Filter by Assigned To
    if (filters.assignedTo !== 'all') {
      result = result.filter(l => 
        String(l.assigned_to).toLowerCase() === filters.assignedTo.toLowerCase() || 
        String(l.lead_owner).toLowerCase() === filters.assignedTo.toLowerCase()
      );
    }

    // Filter by Project
    if (filters.project !== 'all') {
      result = result.filter(l => 
        String(l.project).toLowerCase() === filters.project.toLowerCase() || 
        String(l.initial_project).toLowerCase() === filters.project.toLowerCase() ||
        String(l.final_project).toLowerCase() === filters.project.toLowerCase() ||
        String(l.project_standardized).toLowerCase() === filters.project.toLowerCase()
      );
    }

    // Filter by Category
    if (filters.category !== 'all') {
      result = result.filter(l => String(l.category).toLowerCase() === filters.category.toLowerCase());
    }

    // Filter by Sub Category
    if (filters.subCategory !== 'all') {
      result = result.filter(l => String(l.sub_category).toLowerCase() === filters.subCategory.toLowerCase());
    }

    // Filter by Location
    if (filters.location !== 'all') {
      result = result.filter(l => l.location_preference?.toLowerCase().includes(filters.location.toLowerCase()));
    }

    // Filter by Property Type (mapped to category for generic search)
    if (filters.propertyType !== 'all') {
      result = result.filter(l => l.category?.toLowerCase().includes(filters.propertyType.toLowerCase()));
    }

    // Filter by Date Added
    if (filters.dateAdded !== 'all') {
      const now = new Date();
      result = result.filter(l => {
        const added = new Date(l.created_at);
        const diffDays = (now - added) / (1000 * 60 * 60 * 24);
        if (filters.dateAdded === 'today') return diffDays <= 1;
        if (filters.dateAdded === 'week') return diffDays <= 7;
        if (filters.dateAdded === 'month') return diffDays <= 30;
        return true;
      });
    }

    // Filter by Last Call Attempt (simulation)
    if (filters.lastCall !== 'all') {
      result = result.filter(l => {
        if (filters.lastCall === 'never') return !l.last_retry_at;
        if (!l.last_retry_at) return false;
        const lastCall = new Date(l.last_retry_at);
        const diffDays = (new Date() - lastCall) / (1000 * 60 * 60 * 24);
        if (filters.lastCall === 'recent') return diffDays <= 30;
        if (filters.lastCall === 'old') return diffDays > 30;
        return true;
      });
    }

    // Sorting
    if (sortBy === 'newest') {
      result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'oldest') {
      result = [...result].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    return result;
  }, [leads, searchQuery, filters, sortBy]);

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
    setSelectedLeads(new Set());
    onCampaignStarted?.(campaign);
  };

  const resetFilters = () => {
    setFilters({
      stage: 'all',
      project: 'all',
      category: 'all',
      subCategory: 'all',
      source: 'all',
      assignedTo: 'all',
      budgetRange: 'any',
      lastCall: 'all',
      location: 'all',
      dateAdded: 'all',
      propertyType: 'all'
    });
  };

  const removeFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: key === 'budgetRange' ? 'any' : 'all' }));
  };

  return (
    <Card className="border border-border shadow-sm flex flex-col h-full bg-card rounded-xl overflow-visible">
      <CardContent className="flex-1 flex flex-col min-h-0 p-0 overflow-visible">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3.5 gap-x-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lead status</label>
                      <Select value={filters.stage} onValueChange={(v) => setFilters(f => ({...f, stage: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {stageList.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Project</label>
                      <Select value={filters.project} onValueChange={(v) => setFilters(f => ({...f, project: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects</SelectItem>
                          {projectList.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lead source</label>
                      <Select value={filters.source} onValueChange={(v) => setFilters(f => ({...f, source: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sources</SelectItem>
                          {sourceList.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
                      <Select value={filters.category} onValueChange={(v) => setFilters(f => ({...f, category: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categoryList.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sub Category</label>
                      <Select value={filters.subCategory} onValueChange={(v) => setFilters(f => ({...f, subCategory: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sub Categories</SelectItem>
                          {subCategoryList.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Budget Range</label>
                      <Select value={filters.budgetRange} onValueChange={(v) => setFilters(f => ({...f, budgetRange: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any Budget</SelectItem>
                          {budgetRangeList.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Assigned to</label>
                      <Select value={filters.assignedTo} onValueChange={(v) => setFilters(f => ({...f, assignedTo: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All agents</SelectItem>
                          {ownerList.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last call attempt</label>
                      <Select value={filters.lastCall} onValueChange={(v) => setFilters(f => ({...f, lastCall: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
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

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Location / city</label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input 
                          placeholder="All locations" 
                          className="h-8.5 pl-8 bg-card border-border text-xs focus-visible:ring-0"
                          value={filters.location === 'all' ? '' : filters.location}
                          onChange={(e) => setFilters(f => ({...f, location: e.target.value || 'all'}))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date added</label>
                      <Select value={filters.dateAdded} onValueChange={(v) => setFilters(f => ({...f, dateAdded: v}))}>
                        <SelectTrigger className="h-8.5 bg-card border-border text-xs">
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

            <Select value={filters.stage} onValueChange={(v) => setFilters(f => ({...f, stage: v}))}>
              <SelectTrigger className="h-8 w-[110px] rounded-full bg-blue-50/50 border-blue-200 text-blue-700 text-xs font-medium focus:ring-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {stageList.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.project} onValueChange={(v) => setFilters(f => ({...f, project: v}))}>
              <SelectTrigger className="h-8 w-[120px] rounded-full border-border text-muted-foreground text-xs font-medium focus:ring-0">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3 h-3" />
                  <SelectValue placeholder="Project" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projectList.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={(v) => setFilters(f => ({...f, category: v}))}>
              <SelectTrigger className="h-8 w-[120px] rounded-full border-border text-muted-foreground text-xs font-medium focus:ring-0">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3 h-3" />
                  <SelectValue placeholder="Category" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryList.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.source} onValueChange={(v) => setFilters(f => ({...f, source: v}))}>
              <SelectTrigger className="h-8 w-[120px] rounded-full border-border text-muted-foreground text-xs font-medium focus:ring-0">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3" />
                  <SelectValue placeholder="Source" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sourceList.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge variant="secondary" className="px-3 py-1 font-medium bg-[#F87217]/8 text-[#F87217] border border-[#F87217]/20 shrink-0">
            {selectedLeads.size} Selected
          </Badge>
        </div>

        {/* Active Filter Tags */}
        {activeFiltersCount > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap bg-muted/50">
            {Object.entries(filters).map(([key, value]) => {
              if (value === 'all' || value === 'any') return null;
              let label = value;
              if (key === 'stage') label = `Status: ${LEAD_STATUS_OPTIONS.find(o => o.value === value)?.label || value}`;
              if (key === 'source') label = `Source: ${SOURCE_OPTIONS.find(o => o.value === value)?.label || value}`;
              if (key === 'dateAdded') label = DATE_ADDED_OPTIONS.find(o => o.value === value)?.label || value;
              if (key === 'project') label = `Project: ${value}`;
              if (key === 'category') label = `Category: ${value}`;
              if (key === 'subCategory') label = `Sub Category: ${value}`;
              
              return (
                <Badge key={key} variant="secondary" className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 font-medium px-2 py-0.5 text-[11px]">
                  {label}
                  <button onClick={() => removeFilter(key)}><X className="w-3 h-3" /></button>
                </Badge>
              );
            })}
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
              <div className="col-span-3">Project</div>
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
                        <div className="font-semibold text-foreground truncate">{lead.name || 'Unnamed'}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Added {timeAgo(lead.created_at)}</div>
                      </div>
                      <div className="col-span-3 text-muted-foreground truncate">
                        <div className="text-xs font-medium">{lead.phone || '-'}</div>
                      </div>
                      <div className="col-span-3">
                         <Badge variant="outline" className="font-medium bg-purple-50 text-purple-700 border-purple-100 text-[10px] px-2 py-0">
                           {lead.project || 'Signature'}
                         </Badge>
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
      
      <CardFooter className="pt-1.5 pb-2.5">
        <Button
          className="w-full h-10 gap-2 bg-[#F87217] hover:bg-[#C2560E] text-white rounded-xl text-xs font-semibold transition-all duration-200 shadow-lg shadow-blue-900/10 active:scale-[0.98]"
          size="sm"
          onClick={openLaunch}
          disabled={selectedLeads.size === 0}
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Launch Campaign for {selectedLeads.size} Lead{selectedLeads.size !== 1 && 's'}
        </Button>
      </CardFooter>
      <CampaignLaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        source={{ type: 'leads', prospectIds: Array.from(selectedLeads) }}
        assistants={assistants}
        onCreated={handleCreated}
      />

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        onCreated={onLeadCreated}
      />
    </Card>
  );
}
