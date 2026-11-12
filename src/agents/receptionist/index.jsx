/**
 * AI Receptionist / Router module (doc §2.1, §7.11).
 * Add this agent's endpoints in ./api.js and its screens as tabs below.
 */
import AgentModulePlaceholder from '../AgentModulePlaceholder';

const RoutingRules = () => (
  <AgentModulePlaceholder
    title="Routing rules"
    planned={[
      'Tenant greeting (FR-REC-01)',
      'Intent categories → target agent or human queue (FR-REC-02/03)',
      'Time-of-day and department-availability rules',
      'Message / callback-task fallback when nobody is available (FR-REC-04)',
    ]}
  />
);

const receptionistModule = {
  tabs: [{ id: 'routing', label: 'Routing', Component: RoutingRules }],
};

export default receptionistModule;
