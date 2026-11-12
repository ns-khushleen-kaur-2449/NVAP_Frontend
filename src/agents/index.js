/**
 * Agent module registry — the plug-in point for each agent's own frontend.
 *
 * Every agent type shares the platform screens (overview, configuration, test,
 * calls, activation). A module adds the screens only that agent needs as extra
 * tabs on /app/agents/:instanceId/:tab. To integrate an agent's backend:
 *
 *   1. Put its endpoints in src/agents/<type>/api.js (use `http`/`call` from ../../api/client).
 *   2. Replace the placeholder tab components in src/agents/<type>/index.jsx.
 *   3. Nothing else changes — routing, nav and the shell pick the tabs up from here.
 *
 * Module shape: { tabs: [{ id, label, Component }] }. Each Component receives
 * `{ instance, agent }` (the tenant's agent instance and its catalog entry).
 */
import { AGENT_TYPES } from '../config/agents';
import receptionist from './receptionist';
import outbound from './outbound';
import sdr from './sdr';
import hiring from './hiring';
import realEstate from './real-estate';

const MODULES = {
  [AGENT_TYPES.RECEPTIONIST]: receptionist,
  [AGENT_TYPES.OUTBOUND]: outbound,
  [AGENT_TYPES.SDR]: sdr,
  [AGENT_TYPES.HIRING]: hiring,
  [AGENT_TYPES.REAL_ESTATE]: realEstate,
};

export function moduleTabsFor(type) {
  return MODULES[type]?.tabs ?? [];
}
