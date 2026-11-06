/**
 * Step-up verification for high-risk Super Admin actions. The backend answers such a request 403 with
 * `X-Auth-Required-Action: step_up_required` until this session has passed a fresh code check; api.js then asks
 * the registered dialog (components/auth/StepUpDialog.jsx) for a code and retries the request once. The backend
 * enforces it; this only saves the user from retrying by hand.
 */

let handler = null;

/** The dialog registers itself: `ask()` resolves true once verified, false when cancelled. */
export function setStepUpHandler(ask) {
  handler = ask;
  return () => { if (handler === ask) handler = null; };
}

export async function requestStepUp() {
  return handler ? handler() : false;
}

export const STEP_UP_REQUIRED = 'step_up_required';
export const MFA_ENROLLMENT_REQUIRED = 'mfa_enrollment_required';
export const ACCOUNT_LOCKED = 'account_locked';
