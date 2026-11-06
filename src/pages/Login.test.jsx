import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { renderWithAuth } from '@/test/renderWithAuth';
import LoginPage from './Login';

// Decorative visuals (3D canvas, marketing cards) are not what this test is about.
jest.mock('@/components/marketing/HeroWave3D', () => () => null);
jest.mock('@/components/marketing/ProductVisuals', () => ({ VoiceCard: () => null }));
jest.mock('@/components/shared/HelperCharacter', () => () => null);
jest.mock('@/components/shared/ThemeToggle', () => () => null);

it('shows the sign-in form', () => {
  renderWithAuth(<LoginPage />, { path: '/login' });
  expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
  expect(screen.getByTestId('login-password-input')).toHaveAttribute('type', 'password');
  expect(screen.getByTestId('login-submit-btn')).toBeEnabled();
});

it('never shows an account or password on the page', () => {
  const { container } = renderWithAuth(<LoginPage />, { path: '/login' });
  const text = container.textContent;
  expect(screen.queryByText(/demo account/i)).not.toBeInTheDocument();
  // No "someone@example.com / something" pair anywhere, whatever the account.
  expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+\s*\/\s*\S+/);
  expect(screen.getByTestId('login-email-input')).toHaveValue('');
  expect(screen.getByTestId('login-password-input')).toHaveValue('');
});

it('signs in with what the person typed', async () => {
  const login = jest.fn().mockResolvedValue({});
  renderWithAuth(<LoginPage />, { path: '/login', auth: { login } });
  fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'person@company.com' } });
  fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'typed-by-the-person' } });
  fireEvent.click(screen.getByTestId('login-submit-btn'));
  await waitFor(() => expect(login).toHaveBeenCalledWith('person@company.com', 'typed-by-the-person'));
});

it.each([
  ['super_admin', 'admin-overview'],
  ['tenant_admin', 'dashboard'],
])('after signing in, a %s lands on the %s page', async (role, page) => {
  const login = jest.fn().mockResolvedValue({ user: { id: 9, role } });
  const routes = [
    <Route key="admin" path="/admin/overview" element={<div>admin-overview</div>} />,
    <Route key="dashboard" path="/dashboard" element={<div>dashboard</div>} />,
  ];
  renderWithAuth(<LoginPage />, { path: '/login', auth: { login }, routes });
  fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'person@company.com' } });
  fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'typed-by-the-person' } });
  fireEvent.click(screen.getByTestId('login-submit-btn'));
  expect(await screen.findByText(page)).toBeInTheDocument();
});

describe('two-factor sign-in for a Super Admin', () => {
  const signInWithPassword = () => {
    fireEvent.change(screen.getByTestId('login-email-input'), { target: { value: 'sam@x.co' } });
    fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'typed-by-the-person' } });
    fireEvent.click(screen.getByTestId('login-submit-btn'));
  };

  it('asks for a code after the password, then signs in with it', async () => {
    const login = jest.fn().mockResolvedValue({ mfa_required: true, mfa_token: 'challenge' });
    const completeMfaLogin = jest.fn().mockResolvedValue({ user: { id: 1, role: 'super_admin' } });
    const routes = [<Route key="admin" path="/admin/overview" element={<div>admin-overview</div>} />];
    renderWithAuth(<LoginPage />, { path: '/login', auth: { login, completeMfaLogin }, routes });
    signInWithPassword();
    const code = await screen.findByLabelText('Authentication code');
    fireEvent.change(code, { target: { value: '12 34 56x' } });
    expect(code).toHaveValue('123456');
    fireEvent.click(screen.getByTestId('login-mfa-submit'));
    await waitFor(() => expect(completeMfaLogin).toHaveBeenCalledWith('challenge', { code: '123456' }));
    expect(await screen.findByText('admin-overview')).toBeInTheDocument();
  });

  it('takes a recovery code instead, and shows a wrong code inline', async () => {
    const login = jest.fn().mockResolvedValue({ mfa_required: true, mfa_token: 'challenge' });
    const completeMfaLogin = jest.fn().mockRejectedValue({ response: { status: 401, data: { detail: "That code didn't work." } } });
    renderWithAuth(<LoginPage />, { path: '/login', auth: { login, completeMfaLogin } });
    signInWithPassword();
    fireEvent.click(await screen.findByRole('button', { name: 'Use a recovery code' }));
    fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: ' abcde-12345 ' } });
    fireEvent.click(screen.getByTestId('login-mfa-submit'));
    await waitFor(() => expect(completeMfaLogin).toHaveBeenCalledWith('challenge', { recoveryCode: 'abcde-12345' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work.");
  });

  it('says when sign-in is locked', async () => {
    const login = jest.fn().mockResolvedValue({ mfa_required: true, mfa_token: 'challenge' });
    const completeMfaLogin = jest.fn().mockRejectedValue({ response: { status: 429, data: { detail: 'Too many attempts.' } } });
    renderWithAuth(<LoginPage />, { path: '/login', auth: { login, completeMfaLogin } });
    signInWithPassword();
    fireEvent.change(await screen.findByLabelText('Authentication code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByTestId('login-mfa-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Wait a few minutes');
  });

  it('goes back to the password when the challenge expired', async () => {
    const login = jest.fn().mockResolvedValue({ mfa_required: true, mfa_token: 'challenge' });
    const completeMfaLogin = jest.fn().mockRejectedValue({ response: { status: 401, data: { detail: 'Sign in again' } } });
    renderWithAuth(<LoginPage />, { path: '/login', auth: { login, completeMfaLogin } });
    signInWithPassword();
    fireEvent.change(await screen.findByLabelText('Authentication code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByTestId('login-mfa-submit'));
    expect(await screen.findByTestId('login-password-input')).toBeInTheDocument();
  });
});
