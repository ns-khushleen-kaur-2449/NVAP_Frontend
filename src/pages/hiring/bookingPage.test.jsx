import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { HiringRoute } from '@/pages/hiring/HiringAgent';
import * as api from '@/lib/api';
import {
  IDLE_REFRESH_MS, LIVE_REFRESH_MS, callBlocker, callOutcome, callRefusal, interviewResult, refreshInterval,
} from '@/lib/hiring';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listHiringJobs: jest.fn(),
  listHiringBookings: jest.fn(),
  listHiringCandidates: jest.fn(),
  createHiringBooking: jest.fn(),
  getHiringBooking: jest.fn(),
  getHiringJob: jest.fn(),
  getHiringCandidate: jest.fn(),
  startHiringCall: jest.fn(),
  getHiringCallTranscript: jest.fn(),
  getHiringCallRecording: jest.fn(),
}));

const AT = '2026-11-07T09:00:00Z';
const PROMPT = 'SYSTEM PROMPT: never read this to anyone';
const NOT_AVAILABLE = 'Hiring is not available to your organisation';
const SNAPSHOT = [
  { question_id: 'q-1', question_text: 'Why this role?' },
  { question_id: 'q-2', question_text: 'Notice period?' },
];
const BOOKING = {
  id: 'b-1', job_id: 'j-1', job_title: 'Backend engineer', candidate_id: 'c-1', candidate_name: 'Ada Lovelace',
  interview_type: 'audio', status: 'draft', created_by: 2, created_at: AT, updated_at: AT, calls: [],
};
const JOB = {
  id: 'j-1', title: 'Backend engineer', status: 'open', question_count: 1, created_at: AT, updated_at: AT,
  questions: [{ id: 'q-9', position: 1, question_text: 'A question added later' }],
};
const CANDIDATE = {
  id: 'c-1', first_name: 'Ada', last_name: 'Lovelace', phone_number: '+14155550100', email: 'ada@x.co',
  consent_status: 'granted', consent_source: 'application form', consent_recorded_at: AT, consent_recorded_by: 2,
  created_at: AT, updated_at: AT,
};

function call(fields = {}) {
  return {
    id: 'v-1', booking_id: 'b-1', status: 'ended', outcome: 'answered', failure_code: null, requested_by: 3,
    dialed_at: AT, ended_at: AT, created_at: AT, updated_at: AT, interview_outcome: null, questions: null,
    result_problem: null, has_transcript: false, has_recording: false, snapshot: SNAPSHOT, ...fields,
  };
}

const withCalls = (calls, fields = {}) => ({ data: { ...BOOKING, ...fields, calls } });
const running = () => call({ status: 'in_progress', outcome: 'in-progress', ended_at: null });

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-2', key: 'hiring', name: 'Hiring' }] });
  api.listHiringJobs.mockResolvedValue({ data: [JOB] });
  api.listHiringBookings.mockResolvedValue({ data: [BOOKING] });
  api.getHiringBooking.mockResolvedValue({ data: BOOKING });
  api.getHiringJob.mockResolvedValue({ data: JOB });
  api.getHiringCandidate.mockResolvedValue({ data: CANDIDATE });
  api.startHiringCall.mockResolvedValue({ status: 201, data: running() });
});

afterEach(() => { jest.useRealTimers(); });

function open(role, path = '/hiring_agent/bookings/b-1') {
  return renderWithAuth(
    <Routes>
      <Route path="/hiring_agent/*" element={<HiringRoute />} />
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes>,
    { user: USERS[role], path },
  );
}

const heading = () => screen.findByRole('heading', { name: 'Ada Lovelace' });
const card = (number) => screen.getByRole('article', { name: `Call ${number}` });

describe('Booking page: who may open it', () => {
  test.each(['tenant_admin', 'manager', 'rep'])('%s opens a booking by its address', async (role) => {
    open(role);
    expect(await heading()).toBeInTheDocument();
    expect(api.getHiringBooking).toHaveBeenCalledWith('b-1');
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('+14155550100')).toBeInTheDocument();
    expect(screen.getByText('Granted')).toBeInTheDocument();
  });

  test('a booking in the list opens its page', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/bookings');
    await user.click(await within(await screen.findByTestId('booking-row-b-1')).findByRole('link', { name: 'Ada Lovelace' }));
    expect(await heading()).toBeInTheDocument();
    expect(api.getHiringBooking).toHaveBeenCalledWith('b-1');
  });

  test('a Super Admin going to the address directly gets 403 and nothing is loaded', () => {
    open('super_admin');
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
    expect(api.getHiringBooking).not.toHaveBeenCalled();
  });

  test('a booking that does not exist (or is another organisation\'s) says so, with the way back', async () => {
    api.getHiringBooking.mockRejectedValue({ response: { status: 404, data: { detail: 'Booking not found' } } });
    open('manager');
    expect(await screen.findByText('Booking not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All bookings' })).toHaveAttribute('href', '/hiring_agent/bookings');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  test('access revoked meanwhile (403): the reason, no retry and no way to call', async () => {
    api.getHiringBooking.mockRejectedValue({ response: { status: 403, data: { detail: NOT_AVAILABLE } } });
    open('manager');
    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_AVAILABLE);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Call candidate/ })).not.toBeInTheDocument();
  });

  test('a failed load can be retried', async () => {
    api.getHiringBooking.mockRejectedValueOnce({ response: { status: 500 } });
    const user = userEvent.setup();
    open('manager');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await heading()).toBeInTheDocument();
  });
});

describe('Booking page: calling the candidate', () => {
  test('a rep sees the calls but has no way to call', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ has_transcript: true })], { status: 'scheduled' }));
    open('rep');
    expect(await screen.findByRole('article', { name: 'Call 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show transcript' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Call candidate/ })).not.toBeInTheDocument();
  });

  test('a double click places one call, and the page then shows it running', async () => {
    let answer;
    api.startHiringCall.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const user = userEvent.setup();
    open('manager');
    const button = await screen.findByRole('button', { name: 'Call candidate' });
    api.getHiringBooking.mockResolvedValue(withCalls([running()], { status: 'scheduled' }));
    await user.dblClick(button);
    expect(api.startHiringCall).toHaveBeenCalledTimes(1);
    expect(api.startHiringCall).toHaveBeenCalledWith('b-1', expect.any(String));
    expect(button).toBeDisabled();
    await act(async () => { answer({ status: 201, data: running() }); });
    expect(toast.success).toHaveBeenCalledWith('Calling Ada Lovelace');
    expect(await screen.findByText('On the call')).toBeInTheDocument();
    expect(screen.getByText('A call is in progress.')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  test('a click whose answer was lost is retried with its key; the next call gets a new one', async () => {
    api.startHiringCall
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ status: 200, data: running() })
      .mockResolvedValueOnce({ status: 201, data: running() });
    const user = userEvent.setup();
    open('manager');
    const button = await screen.findByRole('button', { name: 'Call candidate' });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('The call request got no answer.');
    await user.click(button);
    expect(toast.info).toHaveBeenCalledWith('That call was already placed.');
    await user.click(button);
    const keys = api.startHiringCall.mock.calls.map(([, key]) => key);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  test('a call sent but not confirmed (202) says it will not be dialled again', async () => {
    api.startHiringCall.mockResolvedValue({ status: 202, data: call({ status: 'unknown_dispatch', failure_code: 'timeout' }) });
    const user = userEvent.setup();
    open('manager');
    await user.click(await screen.findByRole('button', { name: 'Call candidate' }));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('never dialled again on its own'));
  });

  test('a refusal shows the reason and what to do, and the next press is a new call', async () => {
    api.startHiringCall.mockRejectedValueOnce({ response: { status: 409, data: { detail: {
      code: 'consent_required', message: 'The candidate has not granted consent to be called' } } } });
    const user = userEvent.setup();
    open('manager');
    const button = await screen.findByRole('button', { name: 'Call candidate' });
    await user.click(button);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The candidate has not granted consent to be called');
    expect(alert).toHaveTextContent("Record the candidate's consent on the Candidates tab, then call.");
    await user.click(button);
    const keys = api.startHiringCall.mock.calls.map(([, key]) => key);
    expect(keys[1]).not.toBe(keys[0]);
  });

  test('calls not set up (503) points to the platform administrator', async () => {
    api.startHiringCall.mockRejectedValue({ response: { status: 503, data: { detail: {
      code: 'calls_not_set_up', message: 'Hiring calls are not set up yet' } } } });
    const user = userEvent.setup();
    open('tenant_admin');
    await user.click(await screen.findByRole('button', { name: 'Call candidate' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Hiring calls are not set up yet');
    expect(alert).toHaveTextContent('Ask your platform administrator');
  });

  test('the button says why it is off', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ interview_outcome: 'completed' })], { status: 'completed' }));
    open('manager');
    expect(await screen.findByText('This interview is already completed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Call candidate' })).toBeDisabled();
  });

  test('three calls use up the booking; a call that was never placed does not count', async () => {
    const ended = (id) => call({ id, interview_outcome: 'incomplete' });
    api.getHiringBooking.mockResolvedValue(withCalls(
      [ended('v-1'), ended('v-2'), call({ id: 'v-3', status: 'dial_failed', outcome: null, failure_code: 'provider_rejected' })],
      { status: 'incomplete' }));
    const { unmount } = open('manager');
    expect(await screen.findByText(/Calls used: 2 of 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Call candidate' })).toBeEnabled();
    unmount();
    api.getHiringBooking.mockResolvedValue(withCalls([ended('v-1'), ended('v-2'), ended('v-3')], { status: 'incomplete' }));
    open('manager');
    expect(await screen.findByText('This booking has had 3 calls already.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Call candidate' })).toBeDisabled();
  });
});

describe('Booking page: live updates', () => {
  test('while a call runs the page asks every 5 s, shows the result, then slows down', async () => {
    jest.useFakeTimers();
    api.getHiringBooking.mockResolvedValue(withCalls([running()], { status: 'scheduled' }));
    open('rep');
    expect(await screen.findByText('On the call')).toBeInTheDocument();
    api.getHiringBooking.mockResolvedValue(withCalls([call({
      interview_outcome: 'completed', has_transcript: true,
      questions: [{ question_id: 'q-1', question_text: 'Why this role?', status: 'answered', answer: 'Growth' },
        { question_id: 'q-2', question_text: 'Notice period?', status: 'declined', answer: null }],
    })], { status: 'completed' }));
    await act(async () => { jest.advanceTimersByTime(LIVE_REFRESH_MS); });
    expect(await screen.findByText('Interview completed')).toBeInTheDocument();
    const settled = api.getHiringBooking.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(IDLE_REFRESH_MS - 1000); });
    expect(api.getHiringBooking).toHaveBeenCalledTimes(settled);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(api.getHiringBooking).toHaveBeenCalledTimes(settled + 1);
  });
});

describe('Booking page: results', () => {
  test('an answered call that missed a question is an incomplete interview, never a completed one', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({
      interview_outcome: 'incomplete',
      questions: [{ question_id: 'q-1', question_text: 'Why this role?', status: 'answered', answer: 'Growth' },
        { question_id: 'q-2', question_text: 'Notice period?', status: 'not_asked', answer: null }],
    })], { status: 'incomplete' }));
    open('rep');
    const first = await screen.findByRole('article', { name: 'Call 1' });
    expect(within(first).getByText('Interview incomplete')).toBeInTheDocument();
    expect(within(first).getByText('Not asked')).toBeInTheDocument();
    expect(within(first).getByText('Growth')).toBeInTheDocument();
    expect(within(first).getAllByText('Answered')).toHaveLength(2); // the call's outcome and question 1
    expect(screen.queryByText('Interview completed')).not.toBeInTheDocument();
  });

  test('a result that needs review says why', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ interview_outcome: 'needs_review',
      result_problem: 'summary_timeout' })], { status: 'needs_review' }));
    open('rep');
    expect(await screen.findByText('Needs review: No call summary arrived.')).toBeInTheDocument();
  });

  test('a call without a result shows the questions it was placed with and waits for the summary', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call()], { status: 'scheduled' }));
    open('rep');
    const first = await screen.findByRole('article', { name: 'Call 1' });
    expect(within(first).getByText('Waiting for the summary')).toBeInTheDocument();
    const asked = within(first).getByRole('region', { name: 'Questions on this call' });
    expect(within(asked).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Why this role?', 'Notice period?']);
    // The job's questions today are what the next call asks; the past call keeps its own.
    const next = await screen.findByRole('region', { name: "Next call's questions" });
    expect(within(next).getByText('A question added later')).toBeInTheDocument();
  });

  test('a call that was not placed says why in words, never as a code', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([
      call({ id: 'v-1', status: 'dial_failed', outcome: null, failure_code: 'provider_rejected', ended_at: AT }),
      call({ id: 'v-2', status: 'dial_failed', outcome: null, failure_code: 'something_new', ended_at: AT }),
    ]));
    open('rep');
    expect(await screen.findByText('The phone provider refused the call.')).toBeInTheDocument();
    expect(within(card(2)).getByText('The call could not be placed.')).toBeInTheDocument();
    expect(within(card(1)).getByText('Not placed')).toBeInTheDocument();
    expect(screen.queryByText(/provider_rejected|something_new/)).not.toBeInTheDocument();
  });

  test('calls are listed newest first', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ id: 'v-1' }), call({ id: 'v-2' })]));
    open('rep');
    await screen.findByRole('article', { name: 'Call 1' });
    expect(screen.getAllByRole('article').map((el) => el.getAttribute('aria-label'))).toEqual(['Call 2', 'Call 1']);
  });
});

describe('Booking page: transcript and recording', () => {
  test('the transcript loads only when asked, and only its text and summary are shown', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ has_transcript: true })]));
    api.getHiringCallTranscript.mockResolvedValue({ data: { call_id: 'v-1', transcript: 'AI: Why this role?\nUser: Growth',
      summary: 'Wants to grow.', messages: [{ role: 'system', message: PROMPT }] } });
    const user = userEvent.setup();
    open('rep');
    const button = await screen.findByRole('button', { name: 'Show transcript' });
    expect(api.getHiringCallTranscript).not.toHaveBeenCalled();
    await user.click(button);
    expect(api.getHiringCallTranscript).toHaveBeenCalledWith('b-1', 'v-1');
    expect(await screen.findByText('Wants to grow.')).toBeInTheDocument();
    expect(screen.getByText(/User: Growth/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(PROMPT))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide transcript' }));
    await user.click(screen.getByRole('button', { name: 'Show transcript' }));
    expect(api.getHiringCallTranscript).toHaveBeenCalledTimes(1); // kept, not asked again
  });

  test('a missing transcript says so and can be asked for again', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ has_transcript: true })]));
    api.getHiringCallTranscript.mockRejectedValue({ response: { status: 404, data: { detail: 'Transcript not found' } } });
    const user = userEvent.setup();
    open('rep');
    await user.click(await screen.findByRole('button', { name: 'Show transcript' }));
    expect(await screen.findByText('No transcript for this call yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  test('the recording plays from a fresh link asked for when wanted; an expired link is replaced once', async () => {
    api.getHiringBooking.mockResolvedValue(withCalls([call({ has_recording: true })]));
    api.getHiringCallRecording
      .mockResolvedValueOnce({ data: { url: 'https://signed.example/1.wav', expires_at: AT } })
      .mockResolvedValueOnce({ data: { url: 'https://signed.example/2.wav', expires_at: AT } });
    const user = userEvent.setup();
    open('rep');
    const play = await screen.findByRole('button', { name: 'Play recording' });
    expect(api.getHiringCallRecording).not.toHaveBeenCalled();
    await user.click(play);
    const audio = await screen.findByTestId('recording-v-1');
    expect(api.getHiringCallRecording).toHaveBeenCalledWith('b-1', 'v-1');
    expect(audio).toHaveAttribute('src', 'https://signed.example/1.wav');
    expect(screen.queryByText(/signed\.example/)).not.toBeInTheDocument();
    fireEvent.error(audio);
    await waitFor(() => expect(screen.getByTestId('recording-v-1')).toHaveAttribute('src', 'https://signed.example/2.wav'));
    fireEvent.error(screen.getByTestId('recording-v-1'));
    expect(await screen.findByText('The recording could not be played.')).toBeInTheDocument();
  });
});

describe('Hiring call rules (lib/hiring.js)', () => {
  test('the page refreshes often only while a call runs or its summary is awaited', () => {
    expect(refreshInterval([])).toBe(IDLE_REFRESH_MS);
    expect(refreshInterval([call({ status: 'dialing' })])).toBe(LIVE_REFRESH_MS);
    expect(refreshInterval([call({ status: 'unknown_dispatch' })])).toBe(LIVE_REFRESH_MS);
    expect(refreshInterval([call()])).toBe(LIVE_REFRESH_MS); // ended, no result yet
    expect(refreshInterval([call({ interview_outcome: 'not_interviewed' })])).toBe(IDLE_REFRESH_MS);
  });

  test('the call button is off for a finished, closed, busy or used-up booking', () => {
    expect(callBlocker({ status: 'draft' }, [])).toBeNull();
    expect(callBlocker({ status: 'cancelled' }, [])).toBe('A cancelled booking cannot be called.');
    expect(callBlocker({ status: 'scheduled' }, [call({ status: 'unknown_dispatch' })]))
      .toBe('The last call is still being confirmed.');
    expect(callBlocker({ status: 'scheduled' }, [call({ status: 'dialing' })])).toBe('A call is in progress.');
  });

  test('a refusal reads the backend message, with a hint when there is something to do', () => {
    expect(callRefusal({ response: { data: { detail: { code: 'job_closed', message: 'This job is closed' } } } }))
      .toEqual({ message: 'This job is closed', hint: 'Reopen the job on the Jobs tab to call.' });
    expect(callRefusal({ response: { data: { detail: 'Booking not found' } } }))
      .toEqual({ message: 'Booking not found', hint: null });
    expect(callRefusal({ response: { data: {} } })).toEqual({ message: 'The call could not be placed.', hint: null });
  });

  test('outcomes and results read as people say them', () => {
    expect(callOutcome(call({ status: 'in_progress', outcome: 'ringing' })).label).toBe('Ringing');
    expect(callOutcome(call({ status: 'ended', outcome: 'ringing' }))).toBeNull();
    expect(callOutcome(call({ status: 'ended', outcome: 'no_answer' })).label).toBe('No answer');
    expect(interviewResult(call({ status: 'in_progress' }))).toBeNull();
    expect(interviewResult(call()).label).toBe('Waiting for the summary');
    expect(interviewResult(call({ interview_outcome: 'completed' })).label).toBe('Interview completed');
  });
});
