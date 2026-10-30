import { appointmentEventItems } from './EventTimeline';

it('names the calendar, never a person, for a change made in the executive\'s calendar', () => {
  const [item] = appointmentEventItems([{ id: 1, type: 'cancelled', summary: 'Meeting cancelled',
    created_at: '2030-01-06T07:00:00Z', actor: { kind: 'executive_calendar', name: null } }], 'Asia/Kolkata');
  expect(item.actor).toBe("changed in the executive's calendar");
  expect(item.actor).not.toMatch(/by the executive/);
  const [lead] = appointmentEventItems([{ id: 2, type: 'cancelled', actor: { kind: 'lead_calendar' } }], 'UTC');
  expect(lead.actor).toBe("from the lead's calendar");
});
