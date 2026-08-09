'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ParallaxProps {
  children: ReactNode;
  /**
   * Pixels the element travels across a full viewport of scrolling. Positive
   * drifts down as the page scrolls down (slower than the page, so it reads as
   * further away); negative drifts up.
   */
  distance?: number;
  className?: string;
}

/**
 * Translates its child as the element crosses the viewport.
 *
 * Reads position in a `requestAnimationFrame` callback rather than doing work
 * inside the scroll handler, so a fast scroll coalesces into one measurement
 * per frame instead of one per event. The transform lives on this wrapper and
 * nothing else, which leaves the child free to run its own keyframe animation
 * on `transform` without the two overwriting each other.
 *
 * Honours `prefers-reduced-motion` by never attaching the listener at all —
 * the element simply stays where the layout put it.
 */
export function Parallax({ children, distance = 60, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;

    const apply = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      // -0.5 when the element sits a full viewport below the fold, +0.5 once it
      // has scrolled a viewport above it; 0 when centred.
      const progress = (viewport / 2 - (rect.top + rect.height / 2)) / viewport;
      const clamped = Math.max(-1, Math.min(1, progress));
      node.style.transform = `translate3d(0, ${(clamped * distance).toFixed(2)}px, 0)`;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [distance]);

  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  );
}
