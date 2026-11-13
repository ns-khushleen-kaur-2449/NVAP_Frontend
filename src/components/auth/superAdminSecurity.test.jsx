import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http } from '@/lib/api';
import * as api from '@/lib/api';
import { REQUIRED_ACTIONS } from '@/lib/AuthContext';
import { requestStepUp, setStepUpHandler } from '@/lib/stepUp';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import AuthGate from './AuthGate';
import StepUpDialog from './StepUpDialog';
import MfaSetupPage from '@/pages/MfaSetup';
import SecurityPage from '@/pages/admin/Security';

jest.mock('@/pages/ChangePassword', () => () => <div>change-password</div>);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const refusal = (config, action) => Promise.reject(Object.assign(new Error('refused'), {
  config, response: { status: 403, data: { detail: 'Confirm it' }, headers: { 'x-auth-required-action': action } },
}));

describe('step-up', () => {
  let originalAdapter;
  beforeEach(() => { originalAdapter = http.defaults.adapter; });
  afterEach(() => { http.defaults.adapter = originalAdapter; });

  it('asks for a code when the server wants a step-up, then retries the action once', async () => {
    const seen = [];
    http.defaults.adapter = (config) => {
      seen.push(config.url);
      if (seen.length === 1) return refusal(config, 'step_up_required');
      return Promise.resolve({ status: 200, data: { ok: true }, headers: {}, config });
    };
    const ask = jest.fn().mockResolvedValue(true);
    const unregister = setStepUpHandler(ask);
    const response = await http.post('/api/admin/tenants/t-1/suspend', { reason: 'x' });
    unregister();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['/api/admin/tenants/t-1/suspend', '/api/admin/tenants/t-1/suspend']);
    expect(response.data).toEqual({ ok: true });
  });

  it('leaves the action refused when the check is cancelled, and never loops', async () => {
    let calls = 0;
    http.defaults.adapter = (config) => { calls += 1; return refusal(config, 'step_up_required'); };
    const unregister = setStepUpHandler(jest.fn().mockResolvedValue(false));
    await expect(http.post('/api/admin/users', {})).rejects.toMatchObject({ response: { status: 403 } });
    unregister();
    expect(calls).toBe(1);
    // Verified but refused again (expired meanwhile): one retry only.
    calls = 0;
    const again = setStepUpHandler(jest.fn().mockResolvedValue(true));
    await expect(http.post('/api/admin/users', {})).rejects.toMatchObject({ response: { status: 403 } });
    again();
    expect(calls).toBe(2);
  });

  it('signing out sends the token being ended, even after the stored copy is gone', async () => {
    let sent;
    http.defaults.adapter = (config) => { sent = config.headers.Authorization; return Promise.resolve({ status: 200, data: {}, headers: {}, config }); };
    localStorage.removeItem('estateops_token');
    await api.authLogout('ending-token');
    expect(sent).toBe('Bearer ending-token');
  });

  it('the dialog verifies a code, and cancelling answers false', async () => {
    const verify = jest.spyOn(api, 'verifyStepUp').mockResolvedValue({ data: {} });
    render(<StepUpDialog />);
    let answer;
    act(() => { answer = requestStepUp(); });
    const dialog = await screen.findByTestId('step-up-dialog');
    fireEvent.change(within(dialog).getByLabelText('Authentication code'), { target: { value: '654321' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));
    await expect(answer).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('654321');

    act(() => { answer = requestStepUp(); });
    fireEvent.click(within(await screen.findByTestId('step-up-dialog')).getByRole('button', { name: 'Cancel' }));
    await expect(answer).resolves.toBe(false);
    verify.mockRestore();
  });

  it('shows a wrong code and an expired or locked state in the dialog', async () => {
    const verify = jest.spyOn(api, 'verifyStepUp')
      .mockRejectedValueOnce({ response: { status: 400, data: { detail: "That code didn't work." } } })
      .mockRejectedValueOnce({ response: { status: 429, data: { detail: 'Too many attempts.' } } });
    render(<StepUpDialog />);
    act(() => { requestStepUp(); });
    const dialog = await screen.findByTestId('step-up-dialog');
    const submit = (code) => {
      fireEvent.change(within(dialog).getByLabelText('Authentication code'), { target: { value: code } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));
    };
    submit('111111');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("That code didn't work.");
    submit('222222');
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Too many attempts. Wait a few minutes'));
    verify.mockRestore();
  });
});

describe('two-factor setup', () => {
  it('a Super Admin without MFA sees only the setup screen', () => {
    jest.spyOn(api, 'startMfaEnrollment').mockReturnValue(new Promise(() => {}));
    renderWithAuth(<AuthGate><div>console</div></AuthGate>, {
      user: USERS.super_admin, path: '/admin/overview', auth: { requiredAction: REQUIRED_ACTIONS.MFA_ENROLLMENT },
    });
    expect(screen.getByTestId('mfa-setup')).toBeInTheDocument();
    expect(screen.queryByText('console')).not.toBeInTheDocument();
  });

  it('scans or types the key, verifies a code, and shows the recovery codes once', async () => {
    jest.spyOn(api, 'startMfaEnrollment').mockResolvedValue({ data: {
      secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', qr_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', issuer: 'SmartSDR' } });
    const completeMfaEnrollment = jest.fn().mockResolvedValue({ recovery_codes: ['aaaaa-bbbbb', 'ccccc-ddddd'] });
    const refreshMe = jest.fn();
    renderWithAuth(<MfaSetupPage />, { user: USERS.super_admin, auth: { completeMfaEnrollment, refreshMe } });
    expect(await screen.findByAltText('QR code for your authenticator app')).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/));
    expect(screen.getByTestId('mfa-setup-key')).toHaveTextContent('JBSW Y3DP');
    fireEvent.change(screen.getByLabelText('Authentication code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify and turn on/ }));
    const codes = await screen.findByTestId('recovery-codes');
    expect(within(codes).getByText('aaaaa-bbbbb')).toBeInTheDocument();
    expect(completeMfaEnrollment).toHaveBeenCalledWith('123456');
    const done = screen.getByRole('button', { name: 'Continue to the console' });
    expect(done).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(done);
    expect(refreshMe).toHaveBeenCalled();
  });

  it('keeps the setup screen with an error for a wrong code', async () => {
    jest.spyOn(api, 'startMfaEnrollment').mockResolvedValue({ data: { secret: 'JBSWY3DP', qr_svg: '<svg/>', issuer: 'SmartSDR' } });
    const completeMfaEnrollment = jest.fn().mockRejectedValue({ response: { status: 400, data: { detail: "That code didn't work." } } });
    renderWithAuth(<MfaSetupPage />, { user: USERS.super_admin, auth: { completeMfaEnrollment } });
    fireEvent.change(await screen.findByLabelText('Authentication code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify and turn on/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work.");
    expect(screen.queryByTestId('recovery-codes')).not.toBeInTheDocument();
  });
});

describe('the Security page', () => {
  const SESSIONS = [
    { id: 's1', current: true, user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120 Safari/537', ip_address: '10.0.0.1',
      created_at: '2026-11-04T10:00:00Z', last_seen_at: '2026-11-04T10:05:00Z', expires_at: '2026-11-04T10:30:00Z' },
    { id: 's2', current: false, user_agent: null, ip_address: '10.0.0.2',
      created_at: '2026-11-04T09:00:00Z', last_seen_at: null, expires_at: '2026-11-04T09:30:00Z' },
  ];
  beforeEach(() => {
    jest.spyOn(api, 'getMfaStatus').mockResolvedValue({ data: { enrolled: true, enrolled_at: '2026-11-01T00:00:00Z', recovery_codes_left: 2 } });
    jest.spyOn(api, 'listOwnSessions').mockResolvedValue({ data: { sessions: SESSIONS } });
    jest.spyOn(api, 'listPlatformUsers').mockResolvedValue({ data: { users: [
      USERS.super_admin, { id: 7, name: 'Pat Peer', email: 'pat@x.co', role: 'super_admin', mfa_status: 'enrolled' }] } });
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows MFA status and this Super Admin\'s sessions, and revokes another one', async () => {
    const revoke = jest.spyOn(api, 'revokeSession').mockResolvedValue({ data: {} });
    renderWithAuth(<SecurityPage />, { user: USERS.super_admin });
    expect(await screen.findByText(/2 recovery codes left/)).toBeInTheDocument();
    expect(screen.getByText(/running low on recovery codes/)).toBeInTheDocument();
    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('This session')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('s2'));
    expect(screen.queryByText('sam@x.co')).not.toBeInTheDocument();  // yourself is not under "Other Super Admins"
  });

  it('regenerates recovery codes and shows them', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(api, 'regenerateRecoveryCodes').mockResolvedValue({ data: { recovery_codes: ['zzzzz-yyyyy'] } });
    renderWithAuth(<SecurityPage />, { user: USERS.super_admin });
    fireEvent.click(await screen.findByRole('button', { name: /New recovery codes/ }));
    expect(await screen.findByText('zzzzz-yyyyy')).toBeInTheDocument();
  });

  it('resets another Super Admin\'s MFA only with a reason', async () => {
    const reset = jest.spyOn(api, 'resetUserMfa').mockResolvedValue({ data: {} });
    renderWithAuth(<SecurityPage />, { user: USERS.super_admin });
    fireEvent.click(await screen.findByRole('button', { name: /Reset 2FA/ }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reset 2FA' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Lost phone' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(reset).toHaveBeenCalledWith(7, 'Lost phone'));
  });
});

it('the Security page says when two-factor sign-in is switched off', async () => {
  jest.spyOn(api, 'getMfaStatus').mockResolvedValue({ data: { required: false, enrolled: false, recovery_codes_left: 0 } });
  jest.spyOn(api, 'listOwnSessions').mockResolvedValue({ data: { sessions: [] } });
  jest.spyOn(api, 'listPlatformUsers').mockResolvedValue({ data: { users: [] } });
  renderWithAuth(<SecurityPage />, { user: USERS.super_admin });
  expect(await screen.findByRole('note')).toHaveTextContent('SUPER_ADMIN_MFA_REQUIRED=false');
  jest.restoreAllMocks();
});
