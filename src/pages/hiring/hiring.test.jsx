import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { HiringRoute } from '@/pages/hiring/HiringAgent';
import * as api from '@/lib/api';
import { BOOKING_STATUS, candidateProblem, checkQuestions, newKey, statusOf } from '@/lib/hiring';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listHiringJobs: jest.fn(),
  getHiringJob: jest.fn(),
  createHiringJob: jest.fn(),
  updateHiringJob: jest.fn(),
  replaceHiringQuestions: jest.fn(),
  listHiringCandidates: jest.fn(),
  createHiringCandidate: jest.fn(),
  updateHiringCandidate: jest.fn(),
  listHiringBookings: jest.fn(),
  createHiringBooking: jest.fn(),
}));

const AT = '2026-11-07T09:00:00Z';
const JOBS = [
  { id: 'j-1', title: 'Backend engineer', status: 'open', question_count: 2, created_at: AT, updated_at: AT },
  { id: 'j-2', title: 'Designer', status: 'closed', question_count: 0, created_at: AT, updated_at: AT },
];
const QUESTIONS = [
  { id: 'q-1', position: 1, question_text: 'Why this role?' },
  { id: 'q-2', position: 2, question_text: 'Notice period?' },
];
const CANDIDATES = [
  { id: 'c-1', first_name: 'Ada', last_name: 'Lovelace', phone_number: '+14155550100', email: 'ada@x.co',
    consent_status: 'granted', consent_source: 'application form', consent_recorded_at: AT, consent_recorded_by: 2,
    created_at: AT, updated_at: AT },
  { id: 'c-2', first_name: 'Alan', last_name: null, phone_number: '+14155550101', email: null,
    consent_status: 'unknown', consent_source: null, consent_recorded_at: null, consent_recorded_by: null,
    created_at: AT, updated_at: AT },
];
const BOOKINGS = [
  { id: 'b-1', job_id: 'j-1', job_title: 'Backend engineer', candidate_id: 'c-1', candidate_name: 'Ada Lovelace',
    interview_type: 'audio', status: 'needs_review', created_by: 2, created_at: AT, updated_at: AT },
];
const NOT_AVAILABLE = 'Hiring is not available to your organisation';
const forbidden = { response: { status: 403, data: { detail: NOT_AVAILABLE } } };

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-2', key: 'hiring', name: 'Hiring' }] });
  api.listHiringJobs.mockResolvedValue({ data: JOBS });
  api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: QUESTIONS } });
  api.createHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', status: 'open', questions: [] } });
  api.updateHiringJob.mockImplementation((id, body) => Promise.resolve({ data: { ...JOBS[0], ...body } }));
  api.replaceHiringQuestions.mockResolvedValue({ data: {} });
  api.listHiringCandidates.mockResolvedValue({ data: CANDIDATES });
  api.createHiringCandidate.mockResolvedValue({ data: {} });
  api.updateHiringCandidate.mockResolvedValue({ data: {} });
  api.listHiringBookings.mockResolvedValue({ data: BOOKINGS });
  api.createHiringBooking.mockResolvedValue({ status: 201, data: BOOKINGS[0] });
});

function open(role, path = '/hiring_agent/bookings') {
  return renderWithAuth(
    <Routes>
      <Route path="/hiring_agent/*" element={<HiringRoute />} />
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes>,
    { user: USERS[role], path },
  );
}

const dialog = () => screen.getByRole('dialog');

describe('Hiring: who may open it', () => {
  test.each(['tenant_admin', 'manager', 'rep'])('%s opens the screen', async (role) => {
    open(role);
    expect(await screen.findByTestId('booking-row-b-1')).toHaveTextContent('Ada Lovelace');
  });

  test('a Super Admin going to the address directly gets 403 and nothing is loaded', () => {
    open('super_admin');
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
    expect(api.listAvailableAgents).not.toHaveBeenCalled();
  });

  test('an organisation that may not use Hiring is told so and nothing else loads', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-1', key: 'sdr', name: 'SmartSDR' }] });
    open('tenant_admin');
    expect(await screen.findByText(NOT_AVAILABLE)).toBeInTheDocument();
    expect(api.listHiringBookings).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Hiring' })).not.toBeInTheDocument();
  });

  test('a 403 from Hiring (access revoked meanwhile) shows the reason and offers no retry', async () => {
    api.listHiringBookings.mockRejectedValue(forbidden);
    open('manager');
    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_AVAILABLE);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  test('a failed load can be retried', async () => {
    api.listHiringBookings.mockRejectedValueOnce({ response: { status: 500 } });
    const user = userEvent.setup();
    open('manager');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('booking-row-b-1')).toBeInTheDocument();
  });

  test('a failed availability check can be retried', async () => {
    api.listAvailableAgents.mockRejectedValueOnce({ response: { status: 500 } });
    const user = userEvent.setup();
    open('rep');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('booking-row-b-1')).toBeInTheDocument();
  });

  test('the bare address opens the Bookings tab', async () => {
    open('rep', '/hiring_agent');
    expect(await screen.findByTestId('booking-row-b-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Hiring: jobs', () => {
  test('a rep reads jobs and their questions but changes nothing', async () => {
    const user = userEvent.setup();
    open('rep', '/hiring_agent/jobs');
    const row = await screen.findByTestId('job-row-j-1');
    expect(screen.queryByRole('button', { name: /new job/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'View questions' }));
    const list = await within(dialog()).findByTestId('questions-read-only');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Why this role?', 'Notice period?']);
    expect(within(dialog()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  test('a job without questions is marked', async () => {
    open('manager', '/hiring_agent/jobs');
    expect(within(await screen.findByTestId('job-row-j-2')).getByText('No questions')).toBeInTheDocument();
  });

  test('a new job goes straight on to its questions', async () => {
    api.getHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', questions: [] } });
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/jobs');
    await user.click(await screen.findByRole('button', { name: /new job/i }));
    await user.type(within(dialog()).getByLabelText(/job title/i), 'Data analyst');
    await user.click(within(dialog()).getByRole('button', { name: 'Create job' }));
    expect(api.createHiringJob).toHaveBeenCalledWith({ title: 'Data analyst' });
    await user.type(await screen.findByLabelText('Question 1'), 'Why this role?');
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(api.replaceHiringQuestions).toHaveBeenCalledWith('j-3', ['Why this role?']);
  });

  test('an empty question is refused before sending, and the saved order is the order shown', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit questions' }));
    const second = await screen.findByLabelText('Question 2');
    await user.clear(second);
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('A question cannot be empty.');
    expect(api.replaceHiringQuestions).not.toHaveBeenCalled();
    await user.type(second, 'Notice period?');
    await user.click(within(dialog()).getByRole('button', { name: 'Move question 1 down' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(api.replaceHiringQuestions).toHaveBeenCalledWith('j-1', ['Notice period?', 'Why this role?']);
  });

  test('no more than eight questions can be added', async () => {
    api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: Array.from({ length: 8 }, (_, i) => (
      { id: `q-${i}`, position: i + 1, question_text: `Question text ${i + 1}` })) } });
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit questions' }));
    await screen.findByLabelText('Question 8');
    expect(within(dialog()).getByRole('button', { name: /add question/i })).toBeDisabled();
  });

  test('a job is closed and reopened', async () => {
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Close' }));
    expect(api.updateHiringJob).toHaveBeenCalledWith('j-1', { status: 'closed' });
    await user.click(within(screen.getByTestId('job-row-j-2')).getByRole('button', { name: 'Reopen' }));
    expect(api.updateHiringJob).toHaveBeenCalledWith('j-2', { status: 'open' });
  });
});

describe('Hiring: candidates', () => {
  test('granted consent needs a source before anything is sent', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/candidates');
    await user.click(await screen.findByRole('button', { name: /new candidate/i }));
    const form = within(dialog());
    await user.type(form.getByLabelText(/first name/i), 'Grace');
    await user.type(form.getByLabelText(/phone number/i), '4155550102');
    await user.selectOptions(form.getByLabelText(/consent to be called/i), 'granted');
    await user.click(form.getByRole('button', { name: 'Add candidate' }));
    expect(form.getByRole('alert')).toHaveTextContent(/how consent was given/i);
    expect(api.createHiringCandidate).not.toHaveBeenCalled();
    await user.type(form.getByLabelText(/how consent was given/i), 'verbal');
    await user.click(form.getByRole('button', { name: 'Add candidate' }));
    expect(api.createHiringCandidate).toHaveBeenCalledWith({
      first_name: 'Grace', last_name: null, phone_number: '4155550102', email: null, consent_status: 'granted',
      consent_source: 'verbal' });
  });

  test('an edit sends only what changed', async () => {
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/candidates');
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Edit' }));
    const email = within(dialog()).getByLabelText(/email/i);
    await user.clear(email);
    await user.type(email, 'ada@new.co');
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(api.updateHiringCandidate).toHaveBeenCalledWith('c-1', { email: 'ada@new.co' });
  });

  test('search asks the backend', async () => {
    const user = userEvent.setup();
    open('rep', '/hiring_agent/candidates');
    await screen.findByTestId('candidate-row-c-1');
    await user.type(screen.getByLabelText('Search'), 'ada');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ q: 'ada', limit: 50 }));
  });

  test('a rep cannot add or edit candidates', async () => {
    open('rep', '/hiring_agent/candidates');
    const row = await screen.findByTestId('candidate-row-c-2');
    expect(within(row).getByText('Not recorded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new candidate/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('Hiring: bookings', () => {
  test('statuses read as words and the filters go to the backend', async () => {
    const user = userEvent.setup();
    open('rep');
    expect(within(await screen.findByTestId('booking-row-b-1')).getByText('Needs review')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByLabelText('Job')).getAllByRole('option')).toHaveLength(3));
    await user.selectOptions(screen.getByLabelText('Job'), 'j-1');
    await user.selectOptions(screen.getByLabelText('Status'), 'completed');
    await waitFor(() => expect(api.listHiringBookings)
      .toHaveBeenLastCalledWith({ job_id: 'j-1', status: 'completed', limit: 50 }));
    expect(screen.queryByRole('button', { name: /new booking/i })).not.toBeInTheDocument();
  });

  async function startBooking(user, candidateId = 'c-1') {
    await user.click(await screen.findByRole('button', { name: /new booking/i }));
    const form = within(dialog());
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    await waitFor(() => expect(form.getAllByRole('option', { name: /ada lovelace/i })).toHaveLength(1));
    await user.selectOptions(form.getByLabelText(/^candidate/i), candidateId);
    return form;
  }

  test('a double click makes one booking', async () => {
    let finish;
    api.createHiringBooking.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    open('manager');
    const form = await startBooking(user);
    const create = form.getByRole('button', { name: 'Create booking' });
    await user.dblClick(create);
    expect(api.createHiringBooking).toHaveBeenCalledTimes(1);
    expect(api.createHiringBooking).toHaveBeenCalledWith({ job_id: 'j-1', candidate_id: 'c-1', idempotency_key: expect.any(String) });
    finish({ status: 201, data: BOOKINGS[0] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('a refusal stays in the dialog, and trying again reuses the same key', async () => {
    api.createHiringBooking.mockRejectedValueOnce({ response: { status: 409,
      data: { detail: 'This candidate already has an open booking for this job' } } });
    const user = userEvent.setup();
    open('tenant_admin');
    const form = await startBooking(user);
    await user.click(form.getByRole('button', { name: 'Create booking' }));
    expect(await form.findByRole('alert')).toHaveTextContent('already has an open booking');
    await user.click(form.getByRole('button', { name: 'Create booking' }));
    const [first, second] = api.createHiringBooking.mock.calls.map(([body]) => body.idempotency_key);
    expect(second).toBe(first);
  });

  test('a candidate without consent is flagged before booking', async () => {
    const user = userEvent.setup();
    open('manager');
    const form = await startBooking(user, 'c-2');
    expect(form.getByText(/consent is not granted/i)).toBeInTheDocument();
  });
});

describe('lib/hiring', () => {
  test('question sets are trimmed, 1 to 8, none blank', () => {
    expect(checkQuestions([' Why this role? ', 'Notice?'])).toEqual({ questions: ['Why this role?', 'Notice?'] });
    expect(checkQuestions([]).error).toMatch(/at least one/i);
    expect(checkQuestions(['A', '  ']).error).toMatch(/empty/i);
    expect(checkQuestions(Array(9).fill('Q')).error).toMatch(/at most 8/i);
  });

  test('candidate forms need a name, a phone and a consent source when granted', () => {
    const form = { first_name: 'Ada', last_name: '', phone_number: '+1415', email: '', consent_status: 'unknown', consent_source: '' };
    expect(candidateProblem(form)).toBeNull();
    expect(candidateProblem({ ...form, first_name: ' ' })).toMatch(/first name/i);
    expect(candidateProblem({ ...form, phone_number: '' })).toMatch(/phone/i);
    expect(candidateProblem({ ...form, consent_status: 'granted' })).toMatch(/consent/i);
  });

  test('statuses read as words; an unknown one as it is', () => {
    expect(statusOf(BOOKING_STATUS, 'draft').label).toBe('Not called yet');
    expect(statusOf(BOOKING_STATUS, 'something_new')).toEqual({ label: 'something_new', tone: 'neutral' });
  });

  test('each action gets its own key', () => {
    expect(newKey()).not.toBe(newKey());
  });
});
