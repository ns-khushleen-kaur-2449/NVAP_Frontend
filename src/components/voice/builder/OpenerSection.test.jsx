import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OpenerSection from './OpenerSection';

function Harness({ leadFields, errors, warnings }) {
  const [message, setMessage] = useState('Hi ');
  return (
    <OpenerSection personalized firstMessage={message} onFirstMessage={setMessage} leadFields={leadFields}
      mentionsReason={false} onMentionsReason={() => {}} defaultReason="" onDefaultReason={() => {}}
      errors={errors} warnings={warnings} />
  );
}

const offered = () => screen.getAllByRole('button').map((b) => b.textContent.replace('+ ', '')).filter((t) => t.startsWith('{'));

it('offers name placeholders only when first name is selected to greet', () => {
  const { unmount } = render(<Harness leadFields={[{ key: 'city', usage: 'context' }, { key: 'email', usage: 'confirm_only' }]} />);
  expect(offered()).toEqual(['{agent_name}', '{company}', '{call_reason}']);
  unmount();
  render(<Harness leadFields={[{ key: 'first_name', usage: 'greet' }]} />);
  expect(offered()).toEqual(['{salutation}', '{customer_name}', '{agent_name}', '{company}', '{call_reason}']);
});

it('inserts a placeholder into the line', () => {
  render(<Harness leadFields={[{ key: 'first_name', usage: 'greet' }]} />);
  fireEvent.click(screen.getByRole('button', { name: '+ {customer_name}' }));
  expect(screen.getByLabelText('Custom opening line')).toHaveValue('Hi {customer_name}');
});

it('shows errors and warnings against the field', () => {
  render(<Harness leadFields={[]} errors={{ first_message: ['first_message: unknown placeholder {name}'] }}
    warnings={['first_message asks no question']} />);
  expect(screen.getByRole('alert')).toHaveTextContent('unknown placeholder {name}');
  expect(screen.getByText('first_message asks no question')).toBeInTheDocument();
});
