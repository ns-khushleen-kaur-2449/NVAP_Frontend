import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import ThemeToggle from '../../components/ThemeToggle';
import Field from '../../components/Field';
import { Button, Panel, TextLink } from '../../components/primitives';
import { useSession } from '../../context/SessionContext';
import { ROLES, ROLE_LABELS, homeFor } from '../../config/roles';
import { USE_MOCKS, errorMessage } from '../../api/client';

export default function SignIn() {
  const { user, role, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ busy: false, error: null });

  if (user) return <Navigate to={location.state?.from || homeFor(role)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setState({ busy: true, error: null });
    try {
      const result = await signIn(form);
      navigate(location.state?.from || homeFor(result.user.role), { replace: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err) });
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[var(--nv-feature-bg)] p-12 text-[var(--nv-feature-fg)]">
        <Logo />
        <div>
          <h1 className="text-4xl font-bold leading-tight">Your voice agents,<br />one workspace.</h1>
          <p className="mt-4 max-w-md text-[var(--nv-feature-muted)]">
            Configure, test, activate and monitor every agent your organization runs on NVIP.
          </p>
        </div>
        <p className="text-sm text-[var(--nv-feature-muted)]">© Netsmartz</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <TextLink to="/">← Back to agents</TextLink>
            <ThemeToggle />
          </div>
          <h2 className="text-3xl font-bold">Sign in</h2>
          <p className="mt-1 text-[var(--nv-muted)]">Use the invite your administrator sent you.</p>
          <Panel className="mt-8 p-6">
            <form onSubmit={onSubmit} className="space-y-5">
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Password" name="password" type="password" required={!USE_MOCKS} autoComplete="current-password" />
              {USE_MOCKS && (
                <Field label="Sign in as (demo only)" name="role" as="select" defaultValue={ROLES.TENANT_ADMIN}
                  hint="Mock mode: pick a role to preview its workspace. Removed when the real backend is on.">
                  {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Field>
              )}
              {state.error && <p className="text-sm text-[var(--nv-danger)]" role="alert">{state.error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={state.busy}>
                {state.busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
