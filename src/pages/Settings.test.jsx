import { fireEvent, screen, within } from '@testing-library/react';
import SettingsPage from './Settings';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
// Each tab's content has its own tests; here only which tabs exist and which one opens.
jest.mock('@/components/CalendarConnections', () => () => <div>calendar-connections</div>);
jest.mock('@/components/admin/ToolsManager', () => () => <div>tools-manager</div>);
jest.mock('@/components/admin/SchedulingSetup', () => () => <div>scheduling-setup</div>);
jest.mock('@/components/ops/OperationsSettings', () => () => <div>operations-settings</div>);
jest.mock('@/components/ops/LeadScoringSettings', () => () => <div>lead-scoring-settings</div>);

const api = require('@/lib/api');
beforeEach(() => { api.getSettings.mockResolvedValue({ data: null }); });

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

it('shows one tab per area for a Tenant Admin, General first', () => {
  renderWithAuth(<SettingsPage />, { user: USERS.tenant_admin, path: '/settings' });
  expect(tabNames()).toEqual(['General', 'Calendar', 'Meeting scheduling', 'Calling rules', 'Lead scoring']);
  expect(screen.queryByText('scheduling-setup')).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Meeting scheduling' }));
  expect(screen.getByText('scheduling-setup')).toBeInTheDocument();
});

it('opens the tab named in the link, and the calendar tab for /settings/calendar', () => {
  const { unmount } = renderWithAuth(<SettingsPage />, { user: USERS.manager, path: '/settings?tab=rules' });
  expect(screen.getByText('operations-settings')).toBeInTheDocument();
  unmount();
  renderWithAuth(<SettingsPage />, { user: USERS.rep, path: '/settings/calendar' });
  expect(screen.getByText('calendar-connections')).toBeInTheDocument();
});

it('gives a Sales Rep only General and Calendar; an unknown tab falls back to General', () => {
  renderWithAuth(<SettingsPage />, { user: USERS.rep, path: '/settings?tab=tools' });
  expect(tabNames()).toEqual(['General', 'Calendar']);
  expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
});

it.each([
  ['super_admin', ['Tenants', 'Users']],
  ['tenant_admin', ['Users', 'Teams']],
  ['manager', ['Users']],
])('lists the admin pages a %s may open under General', (role, expected) => {
  renderWithAuth(<SettingsPage />, { user: USERS[role], path: '/settings' });
  const card = screen.getByTestId('settings-admin');
  expect(within(card).getAllByRole('link').map((l) => l.textContent)).toEqual(expected);
});

it('gives a Sales Rep no Administration card', () => {
  renderWithAuth(<SettingsPage />, { user: USERS.rep, path: '/settings' });
  expect(screen.queryByTestId('settings-admin')).not.toBeInTheDocument();
});
