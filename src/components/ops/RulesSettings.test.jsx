import { render, screen } from '@testing-library/react';
import RulesSettings from './RulesSettings';

const response = (extra) => ({ data: { rules: {}, defaults: {}, overridden: [], fields: {}, ...extra } });

it('says when the contact rules are not applied', async () => {
  render(<RulesSettings title="Contact rules" load={() => Promise.resolve(response({ enforced: false }))}
    save={jest.fn()} editable groups={[]} scopeKey="own" />);
  expect(await screen.findByRole('status')).toHaveTextContent('Not applied right now');
});

it('shows no notice when the rules apply, or for rules without the flag', async () => {
  const { unmount } = render(<RulesSettings title="Contact rules" load={() => Promise.resolve(response({ enforced: true }))}
    save={jest.fn()} editable groups={[]} scopeKey="own" />);
  expect(await screen.findByText('Contact rules')).toBeInTheDocument();
  expect(screen.queryByText(/Not applied right now/)).not.toBeInTheDocument();
  unmount();
  render(<RulesSettings title="Appointment rules" load={() => Promise.resolve(response({}))} save={jest.fn()} editable
    groups={[]} scopeKey="own" />);
  expect(await screen.findByText('Appointment rules')).toBeInTheDocument();
  expect(screen.queryByText(/Not applied right now/)).not.toBeInTheDocument();
});
