import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const HEADER_HEIGHT_CSS_VAR = '--app-header-height';

export default function Header() {
  const { user, logout } = useAuth();
  const headerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    function publishHeight(height: number) {
      document.documentElement.style.setProperty(
        HEADER_HEIGHT_CSS_VAR,
        `${height}px`
      );
    }

    publishHeight(headerEl.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        publishHeight(entry.contentRect.height);
      }
    });
    observer.observe(headerEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-[#404040] bg-[#181818]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/playlists" className="flex items-center gap-2 no-underline">
          <span className="text-2xl">🎉</span>
          <span className="hidden text-lg font-bold text-white sm:inline">
            Birthday Playlist Analyzer
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-4">
          <nav className="flex gap-1 md:gap-2">
            <Link
              to="/playlists"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[#b3b3b3] no-underline transition-colors hover:text-white md:px-4"
              title="Playlists"
            >
              <span className="hidden md:inline">Playlists</span>
              <span className="md:hidden">&#9835;</span>
            </Link>
            <Link
              to="/analysis"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[#b3b3b3] no-underline transition-colors hover:text-white md:px-4"
              title="Analysis"
            >
              <span className="hidden md:inline">Analysis</span>
              <span className="md:hidden">&#128200;</span>
            </Link>
            <Link
              to="/settings"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[#b3b3b3] no-underline transition-colors hover:text-white md:px-4"
              title="Settings"
            >
              <span className="hidden md:inline">Settings</span>
              <span className="md:hidden">&#9881;</span>
            </Link>
          </nav>

          {user && (
            <span className="hidden text-sm text-[#b3b3b3] md:inline">
              {user.displayName}
            </span>
          )}

          <button
            onClick={logout}
            className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-white md:px-4"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
