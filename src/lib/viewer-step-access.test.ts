import { describe, expect, it } from 'vitest';
import { viewerMaxVisibleStep } from './viewer-step-access';

describe('viewerMaxVisibleStep', () => {
  it.each([1, 2])(
    'keeps a Viewer on Step 1 while the berkas is still at step %i',
    (progressStep) => {
      expect(viewerMaxVisibleStep(progressStep, undefined)).toBe(1);
    }
  );

  it('opens Lapangan once the berkas has reached Hasil', () => {
    expect(viewerMaxVisibleStep(3, undefined)).toBe(2);
  });

  it('keeps Hasil closed while the berkas is still being decided', () => {
    // Step 3 is where the decision is made — reaching it is not the same as
    // having left it.
    expect(viewerMaxVisibleStep(3, 'SPPTG terdaftar')).toBe(2);
  });

  it('opens Hasil once an approved berkas has moved on to penerbitan', () => {
    expect(viewerMaxVisibleStep(4, 'SPPTG terdaftar')).toBe(3);
  });

  it.each(['SPPTG ditolak', 'SPPTG ditinjau ulang', 'SPPTG terdata', undefined])(
    'leaves Hasil closed at step 4 when the status is %s',
    (status) => {
      // Only an approved berkas legitimately reaches Step 4; any other status
      // there means a stale pointer, not a decision the Viewer may read.
      expect(viewerMaxVisibleStep(4, status)).toBe(2);
    }
  );

  it('never opens Terbitkan SPPTG, however far the berkas has gone', () => {
    for (const status of ['SPPTG terdaftar', 'Terbit SPPTG', undefined]) {
      expect(viewerMaxVisibleStep(4, status)).toBeLessThan(4);
      expect(viewerMaxVisibleStep(99, status)).toBeLessThan(4);
    }
  });
});
