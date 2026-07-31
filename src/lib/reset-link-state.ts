/**
 * Which screen the "atur ulang sandi" page should show.
 *
 * Pulled out of the component because the ordering here is genuinely subtle and
 * got it wrong once: redeeming a reset link invalidates it by design, so the
 * token check that guards the form turns hostile the moment the form succeeds.
 * Cached query state, an in-flight navigation and a spent token all overlap for
 * a few hundred milliseconds, and the wrong precedence flashed "Tautan Tidak
 * Berlaku" over a password that had just been saved.
 */
export type ResetLinkScreen =
  /** No token in the URL, or the server says it is unknown/expired/spent. */
  | 'invalid'
  /** Still asking the server whether the link is good. */
  | 'checking'
  /** Password saved, but the account is deactivated — nowhere to send them. */
  | 'done'
  /** Password saved and a session issued; a redirect is in flight. */
  | 'redirecting'
  /** The link is good and the password form is up. */
  | 'form';

export type ResetLinkInput = {
  hasToken: boolean;
  /** The token check has come back at least once. */
  isFetched: boolean;
  /** The token check's verdict; only meaningful once `isFetched`. */
  isValid: boolean;
  /** The reset mutation has succeeded. */
  submitted: boolean;
  /** Submitted, and the account could not be signed in (it is deactivated). */
  done: boolean;
};

export function resetLinkScreen(state: ResetLinkInput): ResetLinkScreen {
  // Everything below the token check is decided first once the password has
  // actually been saved. After that point the link is *expected* to be dead, so
  // letting the check speak would contradict what just happened.
  if (state.done) return 'done';
  if (state.submitted) return 'redirecting';

  if (!state.hasToken) return 'invalid';
  if (!state.isFetched) return 'checking';
  return state.isValid ? 'form' : 'invalid';
}
