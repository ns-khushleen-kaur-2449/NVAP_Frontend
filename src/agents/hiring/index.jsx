/**
 * Hiring / Recruitment (HireSmartz) module (doc §2.4, §7.8).
 * Add this agent's endpoints in ./api.js and its screens as tabs below.
 */
import AgentModulePlaceholder from '../AgentModulePlaceholder';

const Screening = () => (
  <AgentModulePlaceholder
    title="Job templates & screening questions"
    planned={[
      'Job templates with ordered question sets (FR-HIRE-02)',
      'Scoring criteria and minimum bar for interview offers (FR-HIRE-03/05)',
      'Recording-consent script (FR-HIRE-01)',
    ]}
  />
);

const Candidates = () => (
  <AgentModulePlaceholder
    title="Candidates"
    planned={[
      'Scored candidate list per requisition (FR-HIRE-03)',
      'ATS sync status (FR-HIRE-04)',
      'Booked interviews and reminders (FR-HIRE-06)',
      'Shortlist for recruiter review — no automated hire / reject (FR-HIRE-07)',
    ]}
  />
);

const hiringModule = {
  tabs: [
    { id: 'screening', label: 'Screening', Component: Screening },
    { id: 'candidates', label: 'Candidates', Component: Candidates },
  ],
};

export default hiringModule;
