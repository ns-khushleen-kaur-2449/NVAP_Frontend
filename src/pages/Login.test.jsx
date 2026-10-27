import { fireEvent, screen, waitFor } from '@testing-library/react';
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
