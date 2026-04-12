import { useState, useEffect, useCallback, useRef } from 'react';

const SCROLL_THRESHOLD = 100;

function isPageScrollable(): boolean {
  return document.documentElement.scrollHeight > window.innerHeight + SCROLL_THRESHOLD;
}

function isNearBottom(): boolean {
  const scrollPosition = window.scrollY + window.innerHeight;
  const pageHeight = document.documentElement.scrollHeight;
  return scrollPosition >= pageHeight / 2;
}

export default function ScrollFab() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<'down' | 'up'>('down');
  const [rightOffset, setRightOffset] = useState<number | null>(null);

  const updateState = useCallback(() => {
    setVisible(isPageScrollable());
    setDirection(isNearBottom() ? 'up' : 'down');

    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setRightOffset(window.innerWidth - rect.right);
    }
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const throttledUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateState();
      });
    };

    updateState();
    window.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate, { passive: true });

    const interval = setInterval(updateState, 1000);

    return () => {
      window.removeEventListener('scroll', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);
      clearInterval(interval);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updateState]);

  const handleClick = () => {
    const top = direction === 'up' ? 0 : document.documentElement.scrollHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <>
      <div ref={anchorRef} className="h-0 w-full" />
      {visible && rightOffset !== null && (
        <button
          type="button"
          onClick={handleClick}
          style={{ right: rightOffset + 8 }}
          className="fixed bottom-20 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#1DB954] shadow-lg transition-all duration-200 hover:scale-110 hover:bg-[#1ed760] active:scale-95"
          aria-label={direction === 'up' ? 'Scroll to top' : 'Scroll to bottom'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-6 w-6 text-[#121212] transition-transform duration-200 ${direction === 'up' ? 'rotate-180' : ''}`}
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      )}
    </>
  );
}
