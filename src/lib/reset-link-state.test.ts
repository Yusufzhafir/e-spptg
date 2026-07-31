import { describe, expect, it } from 'vitest';
import { resetLinkScreen, type ResetLinkInput } from './reset-link-state';

const base: ResetLinkInput = {
  hasToken: true,
  isFetched: false,
  isValid: false,
  submitted: false,
  done: false,
};

describe('resetLinkScreen — before submitting', () => {
  it('shows the invalid screen when the URL carries no token', () => {
    expect(resetLinkScreen({ ...base, hasToken: false })).toBe('invalid');
  });

  it('waits rather than judging while the check is still in flight', () => {
    // The bug this guards against is the opposite: treating "not answered yet"
    // as "invalid" would flash the error on every normal page load.
    expect(resetLinkScreen(base)).toBe('checking');
  });

  it('opens the form for a good link', () => {
    expect(resetLinkScreen({ ...base, isFetched: true, isValid: true })).toBe('form');
  });

  it('shows the invalid screen for a spent or expired link', () => {
    expect(resetLinkScreen({ ...base, isFetched: true, isValid: false })).toBe('invalid');
  });
});

describe('resetLinkScreen — after the password has been saved', () => {
  // Redeeming the link marks it used, so a re-check at this moment legitimately
  // answers "invalid". It must not be allowed to overwrite the outcome.
  const spent = { ...base, isFetched: true, isValid: false };

  it('keeps the success screen for a deactivated account', () => {
    expect(resetLinkScreen({ ...spent, submitted: true, done: true })).toBe('done');
  });

  it('shows the redirect state instead of the dead-link error', () => {
    expect(resetLinkScreen({ ...spent, submitted: true })).toBe('redirecting');
  });

  it('holds that outcome even if the query cache was wiped and refetched', () => {
    // `queryClient.clear()` on success resets isFetched to false and then
    // refetches — neither state may resurrect the invalid screen.
    expect(resetLinkScreen({ ...base, submitted: true })).toBe('redirecting');
    expect(resetLinkScreen({ ...base, submitted: true, done: true })).toBe('done');
  });

  it('does not fall back to the form once submitted', () => {
    expect(resetLinkScreen({ ...base, isFetched: true, isValid: true, submitted: true })).toBe(
      'redirecting'
    );
  });
});
