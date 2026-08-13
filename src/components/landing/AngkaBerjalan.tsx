'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts a KPI up from zero the first time it scrolls into view.
 *
 * Four things this deliberately does:
 *
 * - **Renders the real number on the server.** The displayed value is
 *   `nilai * progres`, and `progres` starts at 1, so the prerendered HTML
 *   carries the actual figure for crawlers and for anyone without JavaScript.
 *   The count-up only rewinds to zero once the observer fires on the client.
 * - **Never animates the formatting.** The caller passes the same
 *   `formatAngka`/`formatHektar` used everywhere else on the page, so
 *   separators and decimals are identical at every frame.
 * - **Runs once per mount.** The visit card refetches every minute; without the
 *   `sudahJalan` guard, every one of those refreshes would restart the count and
 *   the card would twitch on a timer.
 * - **Respects `prefers-reduced-motion`.** A number sprinting upward is exactly
 *   what that setting is for; there, it simply stands still.
 */
export function AngkaBerjalan({
  nilai,
  format,
  durasiMs = 1400,
  className,
}: {
  nilai: number;
  format: (value: number) => string;
  durasiMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const sudahJalan = useRef(false);
  /** 0 = start of the count, 1 = the real figure. */
  const [progres, setProgres] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node || sudahJalan.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Rewind on mount rather than at the moment the observer fires, so the real
    // figure is never briefly on screen before the count starts. Inside a frame
    // callback, not the effect body: a synchronous setState here would cascade a
    // render. The server-rendered markup still ships the true number, which is
    // what a crawler and a no-JavaScript visitor read.
    let frame = requestAnimationFrame(() => setProgres(0));
    let mulai: number | null = null;

    const jalan = (waktu: number) => {
      if (mulai === null) mulai = waktu;
      const t = Math.min((waktu - mulai) / durasiMs, 1);
      // ease-out-quart: quick out of the gate, long settle. A linear count reads
      // like a progress bar; a bouncing one reads like a slot machine.
      setProgres(1 - Math.pow(1 - t, 4));
      if (t < 1) frame = requestAnimationFrame(jalan);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        sudahJalan.current = true;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(jalan);
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [durasiMs]);

  return (
    <span ref={ref} className={className}>
      {format(nilai * progres)}
    </span>
  );
}
