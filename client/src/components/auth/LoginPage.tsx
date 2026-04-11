import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const UNAUTHORIZED_ERROR_MESSAGE =
  'Your account is not authorized to use this app. Contact the owner for access.';

const readUnauthorizedErrorFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('error') === 'unauthorized' ? UNAUTHORIZED_ERROR_MESSAGE : null;
};

export default function LoginPage() {
  const { login } = useAuth();
  const [errorMessage] = useState<string | null>(readUnauthorizedErrorFromUrl);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] px-4">
      <div className="w-full max-w-md rounded-xl bg-[#181818] p-10 text-center">
        <div className="mb-6 text-5xl">🎉</div>

        <h1 className="mb-4 text-3xl font-bold text-white">
          Birthday Playlist Analyzer
        </h1>

        <p className="mb-8 text-[#b3b3b3]">
          Discover your musical identity through the lens of your birthday. We
          analyze your listening history to build the ultimate birthday party
          playlist.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        )}

        <button
          onClick={login}
          className="cursor-pointer rounded-full bg-[#1DB954] px-12 py-4 font-bold text-black transition-colors hover:bg-[#1ed760]"
        >
          Connect with Spotify
        </button>
      </div>
    </div>
  );
}
