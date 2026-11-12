/**
 * Inbound Voice SDR module (doc §2.3, §7.7).
 * Add this agent's endpoints in ./api.js and its screens as tabs below.
 */
import AgentModulePlaceholder from '../AgentModulePlaceholder';

const LeadsAndBookings = () => (
  <AgentModulePlaceholder
    title="Leads & bookings"
    planned={[
      'Captured leads with qualification data (FR-SDR-01/03)',
      'CRM sync status per lead (FR-SDR-02)',
      'Booked demos with Nylas calendar view (FR-SDR-04/05)',
      'High-intent handoffs to sales reps (FR-SDR-06)',
    ]}
  />
);

const sdrModule = {
  tabs: [{ id: 'leads', label: 'Leads & Bookings', Component: LeadsAndBookings }],
};

export default sdrModule;
