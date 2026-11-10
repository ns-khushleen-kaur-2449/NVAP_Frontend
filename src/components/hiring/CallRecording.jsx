import { useState } from 'react';
import OpsButton from '@/components/ops/OpsButton';
import { errorMessage } from '@/hooks/useApiAction';
import { getHiringCallRecording } from '@/lib/api';
import { isForbidden, isNotFound } from '@/lib/hiring';

/**
 * Plays a call's recording, the way SDR's call log does (components/voice/CallLogDetail.js): the link is signed and
 * short-lived (about 30 minutes) and <audio> cannot send the login token, so the page asks Hiring's route for a fresh
 * link and plays it directly. Asked for only when someone wants to listen. An expired link fails on play: one new link
 * is fetched and tried. The link itself is never shown as text.
 */
export default function CallRecording({ bookingId, callId }) {
  const [wanted, setWanted] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [retried, setRetried] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const { data } = await getHiringCallRecording(bookingId, callId);
      setUrl(data.url);
    } catch (e) {
      setError(isNotFound(e) ? { text: 'No recording for this call yet.', retry: true }
        : isForbidden(e) ? { text: errorMessage(e, 'You cannot play this recording.'), retry: false }
          : { text: 'The recording could not be loaded.', retry: true });
    }
  };

  const start = () => {
    setWanted(true);
    setRetried(false);
    load();
  };

  if (!wanted) return <OpsButton size="sm" onClick={start}>Play recording</OpsButton>;
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span role="alert">{error.text}</span>
        {error.retry && <OpsButton size="sm" variant="quiet" onClick={start}>Try again</OpsButton>}
      </div>
    );
  }
  if (!url) return <p className="text-sm text-muted-foreground">Loading the recording…</p>;
  return (
    <audio key={url} controls preload="metadata" className="w-full max-w-md" src={url} data-testid={`recording-${callId}`}
      onError={() => {
        if (!retried) {
          setRetried(true);
          load();
        } else {
          setError({ text: 'The recording could not be played.', retry: true });
        }
      }}>
      Your browser does not support audio playback.
    </audio>
  );
}
