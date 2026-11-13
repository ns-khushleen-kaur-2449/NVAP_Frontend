import { useEffect, useRef, useState } from 'react';
import { previewCampaignOffer } from '@/lib/api';
import { offerSaveError } from '@/lib/campaignOffer';

export const PREVIEW_DEBOUNCE_MS = 400;

/**
 * POST /api/campaigns/offer-preview for ``body`` while ``enabled``, at most once per pause in typing
 * (``PREVIEW_DEBOUNCE_MS``). A reply to an older request never replaces a newer one.
 * Returns { preview, loading, error }.
 */
export default function useOfferPreview(body, enabled) {
  const [state, setState] = useState({ preview: null, loading: false, error: '' });
  const latest = useRef(0);
  const key = enabled ? JSON.stringify(body) : '';

  useEffect(() => {
    if (!enabled) {
      latest.current += 1; // anything in flight is now stale
      setState((current) => ({ ...current, loading: false }));
      return undefined;
    }
    const run = ++latest.current;
    setState((current) => ({ ...current, loading: true, error: '' }));
    const timer = setTimeout(async () => {
      try {
        const { data } = await previewCampaignOffer(JSON.parse(key));
        if (run === latest.current) setState({ preview: data, loading: false, error: '' });
      } catch (error) {
        if (run === latest.current) {
          setState({ preview: null, loading: false, error: offerSaveError(error, 'Could not load the preview.') });
        }
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, enabled]);

  return state;
}
