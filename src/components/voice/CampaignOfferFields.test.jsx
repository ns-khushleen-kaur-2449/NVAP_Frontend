import { act, fireEvent, render, screen } from '@testing-library/react';
import { previewCampaignOffer } from '@/lib/api';
import {
  OFFER_HELPER, OFFER_SCOPE_NOTE, OFFER_TOGGLE_LABEL, formatOfferDate, offerCampaignFields, offerFormFrom,
  offerPitchFields, offerSaveError, preflightProblems,
} from '@/lib/campaignOffer';
import { PREVIEW_DEBOUNCE_MS } from '@/hooks/useOfferPreview';
import CampaignOfferFields, { PreflightProblems } from './CampaignOfferFields';

jest.mock('@/lib/api', () => ({ previewCampaignOffer: jest.fn() }));

const PREVIEW = {
  campaign_name: 'Q1 internal push', offer_name: 'Creta SX', offer: '₹50,000 off', offer_valid_until: '2030-01-31',
  valid_until_spoken: 'Thursday, January thirty-first', expired: false,
  sample_line: "By the way, we have a special offer on Creta SX: ₹50,000 off. It's valid until Thursday, January thirty-first.",
  sample_wording: true, language: 'en', direction: 'ltr', missing: [], assistant_warning: null,
};
const OFFER = { announce: true, offering_name: 'Creta SX', offer_text: '₹50,000 off', valid_until: '2030-01-31' };

function Harness({ initial = OFFER, ...props }) {
  const { useState } = require('react');
  const [value, setValue] = useState(initial);
  return <CampaignOfferFields value={value} onChange={setValue} assistantId="asst-1" name="Q1 internal push" {...props} />;
}

beforeEach(() => {
  jest.useFakeTimers();
  previewCampaignOffer.mockReset();
});
afterEach(() => jest.useRealTimers());

const settle = async (ms = PREVIEW_DEBOUNCE_MS) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

it('shows the toggle with its helper and the scope note', () => {
  render(<Harness initial={{ ...OFFER, announce: false }} />);
  expect(screen.getByRole('switch', { name: OFFER_TOGGLE_LABEL })).not.toBeChecked();
  expect(screen.getByText(OFFER_HELPER)).toBeInTheDocument();
  expect(screen.getByText(OFFER_SCOPE_NOTE)).toBeInTheDocument();
  expect(screen.queryByText('What the agent will tell leads')).not.toBeInTheDocument();
  expect(previewCampaignOffer).not.toHaveBeenCalled();
});

it('previews what the agent will tell leads, never the internal campaign name as spoken', async () => {
  previewCampaignOffer.mockResolvedValue({ data: PREVIEW });
  render(<Harness />);
  expect(screen.getByText('What the agent will tell leads')).toBeInTheDocument();
  await settle();
  expect(await screen.findByText('Thursday, January thirty-first')).toBeInTheDocument();
  expect(screen.getByText('Sample wording')).toBeInTheDocument();
  expect(screen.getByText(/special offer on Creta SX/)).toBeInTheDocument();
  expect(screen.queryByText('Q1 internal push')).not.toBeInTheDocument();
  expect(previewCampaignOffer).toHaveBeenCalledWith(expect.objectContaining({
    assistant_id: 'asst-1', offering_name: 'Creta SX', offer_text: '₹50,000 off', offer_valid_until: '2030-01-31' }));
});

it('waits for a pause in typing and ignores a stale reply', async () => {
  let answerFirst;
  previewCampaignOffer
    .mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }))
    .mockResolvedValueOnce({ data: { ...PREVIEW, offer: '₹60,000 off' } });
  render(<Harness />);
  await settle();                                   // first request (slow)
  const details = screen.getByLabelText('Offer details');
  fireEvent.change(details, { target: { value: '₹55,000 off' } });
  await settle(100);
  fireEvent.change(details, { target: { value: '₹60,000 off' } });
  await settle(PREVIEW_DEBOUNCE_MS - 1);
  expect(previewCampaignOffer).toHaveBeenCalledTimes(1);   // still debouncing the typing
  await settle(1);
  expect(previewCampaignOffer).toHaveBeenCalledTimes(2);
  expect(await screen.findByText('₹60,000 off', { selector: 'dd' })).toBeInTheDocument();
  await act(async () => { answerFirst({ data: { ...PREVIEW, offer: 'OLD' } }); });
  expect(screen.queryByText('OLD')).not.toBeInTheDocument();
});

it('shows loading, then an error', async () => {
  previewCampaignOffer.mockRejectedValue({ response: { status: 500, data: { detail: 'Preview unavailable' } } });
  render(<Harness />);
  expect(screen.getByLabelText('Updating')).toBeInTheDocument();
  await settle();
  expect(await screen.findByRole('alert')).toHaveTextContent('Preview unavailable');
});

it('names missing fields, an expired offer and the assistant problem', async () => {
  previewCampaignOffer.mockResolvedValue({ data: { ...PREVIEW, expired: true, sample_line: '',
    missing: [{ field: 'offering_name', label: "What we're offering" }],
    assistant_warning: 'Riya was published before campaign offers existed. Publish it again so it can tell leads about the offer.' } });
  render(<Harness />);
  await settle();
  expect(await screen.findByText(/Publish it again/)).toBeInTheDocument();
  expect(screen.getByText(/last valid day has passed/)).toBeInTheDocument();
  expect(screen.getByLabelText('Missing')).toHaveTextContent("Still needed: What we're offering.");
  expect(screen.queryByText('Sample wording')).not.toBeInTheDocument();
});

it('asks for an assistant first', () => {
  render(<Harness assistantId="" />);
  expect(screen.getByText('Choose an assistant to see the preview.')).toBeInTheDocument();
  expect(previewCampaignOffer).not.toHaveBeenCalled();
});

it('turning the toggle off hides the box and keeps the values', async () => {
  previewCampaignOffer.mockResolvedValue({ data: PREVIEW });
  render(<Harness />);
  fireEvent.click(screen.getByRole('switch', { name: OFFER_TOGGLE_LABEL }));
  expect(screen.queryByText('What the agent will tell leads')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Offer details')).toHaveValue('₹50,000 off');
  expect(screen.getByLabelText('Offer name')).toHaveValue('Creta SX');
  fireEvent.click(screen.getByRole('switch', { name: OFFER_TOGGLE_LABEL }));
  expect(screen.getByText('What the agent will tell leads')).toBeInTheDocument();
});

it('lays the preview out in the agent’s writing direction', async () => {
  previewCampaignOffer.mockResolvedValue({ data: { ...PREVIEW, direction: 'rtl', language: 'ar' } });
  render(<Harness />);
  await settle();
  expect(await screen.findByRole('group', { name: 'Offer preview' })).toHaveAttribute('dir', 'rtl');
  expect(screen.getByLabelText('Offer name')).toHaveAttribute('dir', 'auto');
});

it('shows the values read-only', () => {
  render(<CampaignOfferFields readOnly value={OFFER} onChange={() => {}} />);
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Campaign offer')).toHaveTextContent(`${OFFER_TOGGLE_LABEL}On`);
});

describe('helpers', () => {
  it('reads and writes the one source of truth', () => {
    const campaign = { announce_to_leads: true, offer_valid_until: '2030-01-31',
      pitch: { offering_name: 'Creta', offer_text: '10% off', call_reason: 'x' } };
    const offer = offerFormFrom(campaign);
    expect(offer).toEqual({ announce: true, offering_name: 'Creta', offer_text: '10% off', valid_until: '2030-01-31' });
    expect(offerPitchFields({ ...offer, offer_text: '  ' })).toEqual({ offering_name: 'Creta', offer_text: null });
    expect(offerCampaignFields({ ...offer, valid_until: '' })).toEqual({ announce_to_leads: true, offer_valid_until: null });
  });

  it('explains an amount in a field other than the offer details', () => {
    const error = { response: { status: 422, data: { detail: [
      { loc: ['body', 'pitch', 'call_reason'], msg: 'Value error, must not contain a price; prices come only from tools' }] } } };
    expect(offerSaveError(error, 'x')).toBe("Why we are calling can't include a price or amount. Put amounts only in Offer details.");
    const list = { response: { status: 422, data: { detail: [
      { loc: ['body', 'pitch', 'benefits', 0], msg: 'Value error, must not contain a price' }] } } };
    expect(offerSaveError(list, 'x')).toMatch(/^Benefits can't include a price/);
  });

  it('keeps every pre-flight problem', () => {
    const error = { response: { status: 409, data: { detail:
      "Can't start this campaign:\nTell leads about this campaign is on: fill in \"The offer\".\nSet the last day the offer is valid before starting." } } };
    const problems = preflightProblems(error);
    expect(problems.title).toBe("Can't start this campaign.");
    expect(problems.problems).toHaveLength(2);
    render(<PreflightProblems problems={problems} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(preflightProblems({ response: { status: 409, data: { detail: 'Someone else changed it' } } })).toBeNull();
  });

  it('formats the last valid day without shifting it by timezone', () => {
    expect(formatOfferDate('2030-01-31')).toMatch(/31/);
    expect(formatOfferDate('')).toBe('');
  });
});
