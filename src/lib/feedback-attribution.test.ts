import { describe, expect, it } from 'vitest';
import { stampFeedbackAttribution } from './feedback-attribution';

const ACTOR = { id: 7, nama: 'Siti Rahayu' };

describe('stampFeedbackAttribution', () => {
  it('overwrites a client-supplied pemberi with the authenticated name', () => {
    const result = stampFeedbackAttribution(
      {
        status: 'SPPTG ditolak',
        feedback: { detailFeedback: 'Dokumen kurang', pemberi: 'Bambang Supriyanto' },
      },
      ACTOR
    ) as { feedback: { pemberi: string; detailFeedback: string } };

    expect(result.feedback.pemberi).toBe('Siti Rahayu');
    // Everything else in the feedback object survives.
    expect(result.feedback.detailFeedback).toBe('Dokumen kurang');
  });

  it('overwrites a spoofed verifikator id', () => {
    const result = stampFeedbackAttribution({ verifikator: 12312 }, ACTOR) as {
      verifikator: number;
    };
    expect(result.verifikator).toBe(7);
  });

  it('overwrites verifikator even when the client sent null', () => {
    // Through `unknown`: the input type says null, the assertion is about what
    // the function replaced it with, and the two do not overlap.
    const result = stampFeedbackAttribution({ verifikator: null }, ACTOR) as unknown as {
      verifikator: number;
    };
    expect(result.verifikator).toBe(7);
  });

  it('does not invent a feedback key on a Step 1 / Step 2 save', () => {
    const payload = { namaPemohon: 'Budi', nik: '3201010101010001' };
    const result = stampFeedbackAttribution(payload, ACTOR) as Record<string, unknown>;
    expect('feedback' in result).toBe(false);
    expect('verifikator' in result).toBe(false);
    // Nothing changed, so the same object comes back untouched.
    expect(result).toBe(payload);
  });

  it('leaves the caller payload unmutated', () => {
    const payload = { feedback: { pemberi: 'Bambang Supriyanto' } };
    stampFeedbackAttribution(payload, ACTOR);
    expect(payload.feedback.pemberi).toBe('Bambang Supriyanto');
  });

  it('ignores a feedback value that is not an object', () => {
    for (const feedback of [null, 'x', 42, ['a']]) {
      const result = stampFeedbackAttribution({ feedback }, ACTOR) as {
        feedback: unknown;
      };
      expect(result.feedback).toEqual(feedback);
    }
  });

  it.each([null, undefined, 'string', 42, ['array']])(
    'passes through a non-object payload (%s)',
    (payload) => {
      expect(stampFeedbackAttribution(payload, ACTOR)).toBe(payload);
    }
  );
});
