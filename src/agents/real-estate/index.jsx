/**
 * Real Estate Inquiry & Scheduling module (doc §2.5, §7.9).
 * Add this agent's endpoints in ./api.js and its screens as tabs below.
 */
import AgentModulePlaceholder from '../AgentModulePlaceholder';

const ListingsAndInquiries = () => (
  <AgentModulePlaceholder
    title="Listings & inquiries"
    planned={[
      'Connected property / MLS feed status (FR-RE-01)',
      'Qualified inquiries — intent, budget, timeline (FR-RE-02)',
      'Booked viewings by listing and listing agent (FR-RE-03/05)',
      'Escalations for pricing / legal questions (FR-RE-06)',
    ]}
  />
);

const realEstateModule = {
  tabs: [{ id: 'listings', label: 'Listings & Inquiries', Component: ListingsAndInquiries }],
};

export default realEstateModule;
