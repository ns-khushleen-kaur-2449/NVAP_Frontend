/**
 * NVIP agent catalog — the single source of truth for which agent types exist.
 *
 * Every agent on the platform is a configurable template (architecture doc §2),
 * so adding or changing an agent here updates the marketplace, pricing page,
 * workspace badges and activation checklist in one place.
 *
 * When an agent's own backend is ready, its type-specific screens are plugged
 * in via src/agents/<type>/ — see src/agents/index.js.
 *
 * Prices are placeholders (doc §13: final amounts need commercial sign-off).
 */
import { PhoneCall, Megaphone, MessageSquare, UserSearch, House } from 'lucide-react';

export const AGENT_TYPES = {
  RECEPTIONIST: 'receptionist',
  OUTBOUND: 'outbound',
  SDR: 'sdr',
  HIRING: 'hiring',
  REAL_ESTATE: 'real_estate',
};

export const CATEGORIES = [
  { id: 'all', label: 'All agents' },
  { id: 'sales', label: 'Sales' },
  { id: 'recruitment', label: 'Recruitment' },
  { id: 'support', label: 'Support' },
  { id: 'real_estate', label: 'Real Estate' },
];

export const AGENTS = [
  {
    type: AGENT_TYPES.RECEPTIONIST,
    slug: 'ai-receptionist',
    name: 'AI Receptionist',
    shortName: 'Receptionist',
    category: 'support',
    icon: PhoneCall,
    summary: 'Answers every call, understands intent, and routes to the right agent or department.',
    startingPrice: 199,
    primaryUsers: 'All tenants',
    captures: ['Caller name', 'Company / household', 'Reason for calling', 'Urgency'],
    tools: ['Intent classification', 'Warm transfer (Twilio)', 'Callback tasks', 'Voicemail'],
    systemOfRecord: null,
    booking: 'Callback',
    guardrails: ['Asks before guessing a department', 'Always offers a human'],
  },
  {
    type: AGENT_TYPES.OUTBOUND,
    slug: 'outbound-lead-gen',
    name: 'Outbound Lead Gen',
    shortName: 'Outbound',
    category: 'sales',
    icon: Megaphone,
    summary: 'Calls approved, consented lists — qualifies interest and books follow-ups automatically.',
    startingPrice: 349,
    primaryUsers: 'Sales teams, MSPs',
    captures: ['Interest level', 'Objections', 'Best callback time', 'Do-not-contact requests'],
    tools: ['CRM lookup / update', 'Calendar availability (Nylas)', 'SMS follow-up (Twilio)'],
    systemOfRecord: 'CRM',
    booking: 'Callback / sales meeting',
    guardrails: ['DNC enforced', 'Consent checked before every dial', 'Calling-hour window', 'Attempt caps'],
  },
  {
    type: AGENT_TYPES.SDR,
    slug: 'inbound-voice-sdr',
    name: 'Inbound Voice SDR',
    shortName: 'SDR',
    category: 'sales',
    icon: MessageSquare,
    popular: true,
    summary: 'Qualifies inbound interest, syncs to your CRM, and books demos off a live calendar.',
    startingPrice: 299,
    primaryUsers: 'Businesses receiving sales calls',
    captures: ['Product interest', 'Company size', 'Budget signal', 'Timeline'],
    tools: ['CRM create / update', 'Demo booking (Nylas)', 'Email confirmation (Nylas)'],
    systemOfRecord: 'CRM',
    booking: 'Demo',
    guardrails: ['Live calendar slots only', 'No duplicate CRM records', 'High intent → human rep'],
  },
  {
    type: AGENT_TYPES.HIRING,
    slug: 'hiring-recruitment',
    name: 'Hiring / Recruitment',
    shortName: 'Hiring',
    category: 'recruitment',
    icon: UserSearch,
    summary: 'Screens candidates by phone, scores them against your criteria, and books interviews.',
    startingPrice: 399,
    primaryUsers: 'Recruiters, staffing teams, MSPs',
    captures: ['Experience & skills', 'Location & availability', 'Notice period', 'Work authorization'],
    tools: ['ATS lookup / update', 'Interview scheduling (Nylas)', 'Reminders (SMS / email)'],
    systemOfRecord: 'ATS',
    booking: 'Interview',
    guardrails: ['No auto hire/reject', 'Recording consent gated', 'No protected-characteristic questions'],
  },
  {
    type: AGENT_TYPES.REAL_ESTATE,
    slug: 'real-estate',
    name: 'Real Estate Agent',
    shortName: 'Real Estate',
    category: 'real_estate',
    icon: House,
    summary: 'Answers property questions from live listing data and books viewings directly.',
    startingPrice: 299,
    primaryUsers: 'Brokerages, property managers',
    captures: ['Property of interest', 'Buy / rent / lease intent', 'Budget & timeline', 'Viewing times'],
    tools: ['Property / MLS lookup (read-only)', 'Viewing booking (Nylas)', 'Territory routing'],
    systemOfRecord: 'Property / MLS',
    booking: 'Viewing',
    guardrails: ['Live listing data only', 'Fair-housing scripting', 'Pricing & legal → human'],
  },
];

/** Package tiers per agent (doc §13.2). Volumes are placeholders. */
export const TIERS = {
  [AGENT_TYPES.RECEPTIONIST]: [
    { id: 'starter', name: 'Starter', included: ['Limited monthly inbound minutes', '1 phone number', 'Standard routing rules'] },
    { id: 'growth', name: 'Growth', included: ['Higher minute allowance', 'Time-of-day routing', 'Multiple departments'] },
    { id: 'enterprise', name: 'Enterprise', included: ['Custom volume', 'Dedicated numbers', 'Custom SLAs'] },
  ],
  [AGENT_TYPES.OUTBOUND]: [
    { id: 'starter', name: 'Starter', included: ['Limited monthly call minutes', '1 campaign list', 'Standard CRM connector'] },
    { id: 'growth', name: 'Growth', included: ['Higher minute allowance', 'Multiple concurrent campaigns', 'DNC / consent reporting'] },
    { id: 'enterprise', name: 'Enterprise', included: ['Custom volume', 'Dedicated numbers', 'Regional compliance rules'] },
  ],
  [AGENT_TYPES.SDR]: [
    { id: 'starter', name: 'Starter', included: ['Limited monthly inbound minutes', '1 CRM connector', 'Standard demo booking'] },
    { id: 'growth', name: 'Growth', included: ['Higher minutes', 'Lead scoring customization', 'Multi-rep routing'] },
    { id: 'enterprise', name: 'Enterprise', included: ['Custom volume', 'Multiple products / pipelines', 'Dedicated reporting'] },
  ],
  [AGENT_TYPES.HIRING]: [
    { id: 'starter', name: 'Starter', included: ['Limited screenings / month', '1 ATS connector', 'Standard question sets'] },
    { id: 'growth', name: 'Growth', included: ['Higher screening volume', 'Multiple job templates', 'Interview scheduling automation'] },
    { id: 'enterprise', name: 'Enterprise', included: ['Custom volume', 'Multiple ATS systems', 'Custom retention rules'] },
  ],
  [AGENT_TYPES.REAL_ESTATE]: [
    { id: 'starter', name: 'Starter', included: ['Limited monthly inquiries', '1 listing feed / MLS connector', 'Standard viewing booking'] },
    { id: 'growth', name: 'Growth', included: ['Higher inquiry volume', 'Multiple listings / agents', 'Territory routing'] },
    { id: 'enterprise', name: 'Enterprise', included: ['Custom volume', 'Multiple MLS feeds', 'Dedicated territory rules'] },
  ],
};

export const getAgentByType = (type) => AGENTS.find((a) => a.type === type);
export const getAgentBySlug = (slug) => AGENTS.find((a) => a.slug === slug);
