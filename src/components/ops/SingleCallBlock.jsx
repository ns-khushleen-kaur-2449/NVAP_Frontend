import { Link } from 'react-router-dom';
import RelativeTime from './RelativeTime';
import OpsButton from './OpsButton';

/**
 * Why a single call was refused (the 409 detail: { code, allowed_at, message }) and what can be done.
 * do-not-call ("opted_out") is never overridable; cooldowns and the daily cap are, for Tenant
 * Admins and Managers, with a reason.
 */
export default function SingleCallBlock({ block, canOverride, onOverride }) {
  const optedOut = block.code === 'opted_out';
  return (
    <div role="alert" className={`ops ops-tone ${optedOut ? 'ops-tone-bad' : 'ops-tone-warn'} space-y-2 rounded-[14px] px-4 py-3 text-sm`}>
      {optedOut ? (
        <p className="font-semibold">
          On do-not-call list.{' '}
          <Link to="/operations/do-not-call?tab=all" className="underline">Open the do-not-call page</Link>
        </p>
      ) : (
        <>
          <p className="font-semibold">{block.message}</p>
          {block.allowed_at && (
            <p>Next allowed: <RelativeTime iso={block.allowed_at} mode="absolute" /> (<RelativeTime iso={block.allowed_at} />)</p>
          )}
          {canOverride && <OpsButton size="sm" variant="outline" onClick={onOverride}>Call anyway</OpsButton>}
        </>
      )}
    </div>
  );
}
