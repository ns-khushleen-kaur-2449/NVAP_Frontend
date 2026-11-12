/**
 * Agent lifecycle (architecture doc §26, FR-CORE-09).
 * Only Active agents take live, billable calls.
 */
export const LIFECYCLE = {
  DRAFT: 'draft',
  TESTING: 'testing',
  READY_FOR_TESTING: 'ready_for_testing',
  ACTIVE: 'active',
  PAUSED: 'paused',
  SUSPENDED: 'suspended',
  RETIRED: 'retired',
};

export const LIFECYCLE_META = {
  draft: { label: 'Draft', tone: 'neutral' },
  testing: { label: 'Testing', tone: 'warning' },
  ready_for_testing: { label: 'Ready', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'danger' },
  retired: { label: 'Retired', tone: 'neutral' },
};

/**
 * Transitions a tenant admin can trigger from the portal. System-only moves
 * (Testing → Ready once checks pass, Active → Suspended for billing) are
 * deliberately absent — the UI must never offer them.
 */
const TENANT_TRANSITIONS = {
  draft: [{ to: 'testing', action: 'Start testing' }],
  ready_for_testing: [{ to: 'active', action: 'Approve activation' }],
  active: [{ to: 'paused', action: 'Pause' }],
  paused: [{ to: 'active', action: 'Resume' }],
};

export function tenantActionsFor(state) {
  const actions = [...(TENANT_TRANSITIONS[state] || [])];
  if (state && state !== LIFECYCLE.RETIRED) actions.push({ to: 'retired', action: 'Retire', destructive: true });
  return actions;
}

export const takesLiveCalls = (state) => state === LIFECYCLE.ACTIVE;
