import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from './routes';
import { SessionProvider } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import { SESSION_KEY } from './api/client';
import { ROLES } from './config/roles';
import { navFor, NAV_ITEMS } from './config/navigation';
import { tenantActionsFor } from './lib/lifecycle';
import { checklistFor } from './lib/acceptance';
import { AGENTS } from './config/agents';
import { moduleTabsFor } from './agents';
import { mockTenant } from './api/mocks';

function renderAt(path) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <SessionProvider><AppRoutes /></SessionProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function signInAs(role) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: 't', user: { id: 'u', name: 'Test User', email: 't@example.com', role }, tenant: mockTenant,
  }));
}

afterEach(() => localStorage.clear());

describe('NVIP routing', () => {
  test('public marketplace lists every catalog agent', async () => {
    renderAt('/');
    for (const agent of AGENTS) {
      expect(await screen.findByRole('heading', { name: agent.name })).toBeInTheDocument();
    }
  });

  test('workspace redirects to sign-in without a session', async () => {
    renderAt('/app/dashboard');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('tenant admin sees the dashboard with the tenancy banner', async () => {
    signInAs(ROLES.TENANT_ADMIN);
    renderAt('/app/dashboard');
    expect(await screen.findByRole('heading', { name: 'Beta Staffing workspace' })).toBeInTheDocument();
    // Desktop sidebar + (hidden) mobile drawer both carry the banner.
    expect(screen.getAllByText('Apex MSP').length).toBeGreaterThan(0);
    // Rendered twice: desktop table + mobile card list.
    expect((await screen.findAllByText('Inbound SDR')).length).toBeGreaterThan(0);
  });

  test('agent user is sent to their own home instead of an admin page', async () => {
    signInAs(ROLES.AGENT_USER);
    renderAt('/app/dashboard');
    expect(await screen.findByRole('heading', { name: 'My Queue' })).toBeInTheDocument();
  });

  test('agent page shows that agent type’s module tabs', async () => {
    signInAs(ROLES.TENANT_ADMIN);
    renderAt('/app/agents/ai_hiring_wh');
    expect(await screen.findByRole('link', { name: 'Candidates' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Campaigns' })).not.toBeInTheDocument();
  });
});

describe('NVIP config', () => {
  test('every nav item belongs to at least one role and paths are unique', () => {
    const paths = NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
    NAV_ITEMS.forEach((i) => expect(i.roles.length).toBeGreaterThan(0));
  });

  test('sub-tenants nav item only shows for MSP parent tenants', () => {
    const has = (opts) => navFor(ROLES.TENANT_ADMIN, opts).some((i) => i.path === 'sub-tenants');
    expect(has({ isMspParent: false })).toBe(false);
    expect(has({ isMspParent: true })).toBe(true);
  });

  test('tenants can never self-activate from Testing or un-suspend', () => {
    expect(tenantActionsFor('testing').map((a) => a.to)).not.toContain('active');
    expect(tenantActionsFor('suspended').map((a) => a.to)).not.toContain('active');
    expect(tenantActionsFor('retired')).toEqual([]);
  });

  test('every agent type has a module and an acceptance checklist beyond the shared items', () => {
    const shared = checklistFor('unknown').length;
    AGENTS.forEach((a) => {
      expect(moduleTabsFor(a.type).length).toBeGreaterThan(0);
      expect(checklistFor(a.type).length).toBeGreaterThan(shared);
    });
  });
});

describe('NVIP theme', () => {
  test('toggle switches light/dark on <html> and remembers the choice', async () => {
    renderAt('/');
    const html = document.documentElement;
    const start = html.dataset.theme;
    expect(['light', 'dark']).toContain(start);
    const toggle = screen.getAllByRole('button', { name: /switch to (dark|light) theme/i })[0];
    fireEvent.click(toggle);
    const next = start === 'dark' ? 'light' : 'dark';
    expect(await screen.findAllByRole('button', { name: new RegExp(`switch to ${start} theme`, 'i') })).not.toHaveLength(0);
    expect(html.dataset.theme).toBe(next);
    expect(localStorage.getItem('nvip_theme')).toBe(next);
  });
});

describe('NVIP sidebar', () => {
  test('collapse button toggles the rail and remembers it', async () => {
    signInAs(ROLES.TENANT_ADMIN);
    renderAt('/app/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem('nvip_sidebar_collapsed')).toBe('1');
    // Collapsed links keep their accessible names (labels are faded, not removed).
    expect(screen.getAllByRole('link', { name: /Dashboard/ }).length).toBeGreaterThan(0);
  });
});
