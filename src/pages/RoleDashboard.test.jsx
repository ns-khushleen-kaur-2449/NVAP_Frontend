import { screen, waitFor } from '@testing-library/react';
import RoleDashboard from '@/pages/RoleDashboard';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  getRoleDashboard: jest.fn(),
  getVoiceDashboardSummary: jest.fn(),
  pauseAssistant: jest.fn(),
  resumeAssistant: jest.fn(),
}));

// The voice section has its own tests (components/voice/VoiceDashboard.test.jsx).
jest.mock('@/components/voice/VoiceDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="voice-dashboard" />,
}));

beforeEach(() => {
  jest.clearAllMocks();
  api.getRoleDashboard.mockResolvedValue({ data: { widgets: {} } });
});

describe('Dashboard page', () => {
  test.each(['tenant_admin', 'manager'])('%s sees the voice activity section on the one Dashboard', async (role) => {
    renderWithAuth(<RoleDashboard />, { user: USERS[role], path: '/dashboard' });
    expect(await screen.findByTestId('voice-dashboard')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Dashboard' })).toHaveLength(1);
  });

  test('a Sales Rep, who cannot view assistants, does not get the voice section', async () => {
    renderWithAuth(<RoleDashboard />, { user: USERS.rep, path: '/dashboard' });
    await waitFor(() => expect(api.getRoleDashboard).toHaveBeenCalled());
    expect(screen.queryByTestId('voice-dashboard')).not.toBeInTheDocument();
  });
});
