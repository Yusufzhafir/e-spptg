'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Direction = 'up' | 'left' | 'right' | 'none';

interface RevealProps {
  children: ReactNode;
  /** Slide-in direction before the element settles into place. */
  direction?: Direction;
  /** Stagger, in ms, so siblings can cascade instead of popping together. */
  delay?: number;
  className?: string;
}

const HIDDEN: Record<Direction, string> = {
  up: 'translate-y-6',
  left: '-translate-x-6',
  right: 'translate-x-6',
  none: '',
};

/**
 * Fades content in the first time it scrolls into view.
 *
 * Reveals once and then disconnects — re-animating on every pass is distracting
 * on a page users scroll up and down. Honours `prefers-reduced-motion` by
 * showing content immediately.
 */
export function Reveal({ children, direction = 'up', delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- media query is only readable on the client
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      // Trigger slightly before the element is fully on screen.
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        visible ? 'translate-x-0 translate-y-0 opacity-100' : `opacity-0 ${HIDDEN[direction]}`,
        className
      )}
    >
      {children}
    </div>
  );
}
