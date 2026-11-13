import { screen } from '@testing-library/react';
import FeatureRoute from './FeatureRoute';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import { featureEnabled, voiceTabEnabled } from '@/lib/rbac';
import { tabsFor } from '@/pages/Operations';
import { SETTINGS_TABS } from '@/pages/Settings';

const off = (user, ...keys) => ({ ...user, features: Object.fromEntries(keys.map((key) => [key, false])) });

it('treats a missing switch as on, like the backend', () => {
  expect(featureEnabled(USERS.rep, 'product_catalog')).toBe(true);
  expect(featureEnabled(off(USERS.rep, 'product_catalog'), 'product_catalog')).toBe(false);
});

it('shows the page while the feature is on', () => {
  renderWithAuth(<FeatureRoute features={['product_catalog']} name="Catalog"><p>Products</p></FeatureRoute>,
    { user: USERS.rep });
  expect(screen.getByText('Products')).toBeInTheDocument();
});

it('says so instead of showing a page that would be refused', () => {
  renderWithAuth(<FeatureRoute features={['product_catalog']} name="Catalog"><p>Products</p></FeatureRoute>,
    { user: off(USERS.rep, 'product_catalog') });
  expect(screen.queryByText('Products')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent("Catalog isn't available");
});

it('needs both switches for campaign screens, and none for call logs', () => {
  expect(voiceTabEnabled(off(USERS.rep, 'campaigns'), 'builder')).toBe(false);
  expect(voiceTabEnabled(off(USERS.rep, 'voice_agent'), 'campaigns')).toBe(false);
  expect(voiceTabEnabled(off(USERS.rep, 'campaigns'), 'single')).toBe(true);
  expect(voiceTabEnabled(off(USERS.rep, 'voice_agent', 'campaigns'), 'logs')).toBe(true);
});

it('drops the Appointments tab when booking is off and keeps the rest', () => {
  const ids = (user) => tabsFor(user).map((tab) => tab.id);
  expect(ids(off(USERS.manager, 'appointment_booking'))).toEqual(['callbacks', 'do-not-call', 'intent-review']);
  expect(ids(off(USERS.rep, 'appointment_booking'))).toEqual([]);
  expect(ids(USERS.rep)).toEqual(['appointments']);
});

it('hides the settings tabs of switched-off features', () => {
  const user = off(USERS.tenant_admin, 'appointment_booking', 'lead_scoring', 'crm_zoho');
  const hasRole = (...roles) => roles.includes(user.role);
  const shown = SETTINGS_TABS.filter((tab) => tab.show({ hasRole, user })).map((tab) => tab.value);
  expect(shown).toEqual(['general', 'calendar', 'rules']);
});
