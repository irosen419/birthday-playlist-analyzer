import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateMe } from '../../api/auth';

const MIN_BIRTH_YEAR = 1940;
const MAX_BIRTH_YEAR = new Date().getFullYear();
const DEFAULT_BIRTH_YEAR = 1991;

export default function OnboardingPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [birthYear, setBirthYear] = useState(DEFAULT_BIRTH_YEAR);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const updatedUser = await updateMe({
        birthYear,
        setupCompleted: true,
      });
      setUser(updatedUser);
      navigate('/playlists');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] px-4">
      <div className="w-full max-w-md rounded-xl bg-[#181818] p-10 text-center">
        <div className="mb-6 text-5xl">🎉</div>

        <h1 className="mb-4 text-3xl font-bold text-white">
          Welcome to Birthday Playlist Analyzer!
        </h1>

        <p className="mb-8 text-[#b3b3b3]">
          To get started, tell us what year you were born. We'll use this to
          curate the perfect birthday playlist for you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="birth-year"
              className="mb-2 block text-sm font-semibold text-white"
            >
              What year were you born?
            </label>
            <input
              id="birth-year"
              type="number"
              min={MIN_BIRTH_YEAR}
              max={MAX_BIRTH_YEAR}
              value={birthYear}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              className="w-full rounded-lg border border-[#404040] bg-[#282828] px-4 py-3 text-center text-lg text-white focus:border-[#1DB954] focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-full bg-[#1DB954] px-12 py-4 font-bold text-black transition-colors hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}
