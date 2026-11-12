/**
 * Outbound Lead Generation module (doc §2.2, §7.6, §7.16).
 * Add this agent's endpoints in ./api.js and its screens as tabs below.
 */
import AgentModulePlaceholder from '../AgentModulePlaceholder';

const Campaigns = () => (
  <AgentModulePlaceholder
    title="Campaigns"
    planned={[
      'Upload contact list (CSV) with consent status and time zone (FR-CAMPAIGN-01)',
      'Validation results — rows missing consent / DNC fields flagged (FR-CAMPAIGN-02)',
      'Pause / resume / cancel a campaign (FR-CAMPAIGN-04)',
      'Calling-hour window and attempt caps (FR-OUT-03/04)',
    ]}
  />
);

const DoNotContact = () => (
  <AgentModulePlaceholder
    title="Do-not-contact registry"
    planned={['DNC list view and search', 'Manual DNC entry (POST /dnc)', 'Skipped-contact reasons per campaign']}
  />
);

const outboundModule = {
  tabs: [
    { id: 'campaigns', label: 'Campaigns', Component: Campaigns },
    { id: 'dnc', label: 'Do-not-contact', Component: DoNotContact },
  ],
};

export default outboundModule;
