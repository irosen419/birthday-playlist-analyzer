import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();

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
