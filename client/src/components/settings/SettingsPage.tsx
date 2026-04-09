import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateMe } from '../../api/auth';

const MIN_BIRTH_YEAR = 1940;
const MAX_BIRTH_YEAR = new Date().getFullYear();

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [birthYear, setBirthYear] = useState(user?.birthYear ?? 1991);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      const updatedUser = await updateMe({ displayName, birthYear });
      setUser(updatedUser);
      setSuccessMessage('Settings saved successfully.');
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <button
          onClick={() => navigate('/playlists')}
          className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white"
        >
          Back
        </button>
      </div>

      <div className="rounded-xl bg-[#181818] p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="display-name"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#404040] bg-[#282828] px-4 py-3 text-white focus:border-[#1DB954] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="birth-year"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Birth Year
            </label>
            <input
              id="birth-year"
              type="number"
              min={MIN_BIRTH_YEAR}
              max={MAX_BIRTH_YEAR}
              value={birthYear}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              className="w-full rounded-lg border border-[#404040] bg-[#282828] px-4 py-3 text-white focus:border-[#1DB954] focus:outline-none"
            />
          </div>

          {successMessage && (
            <p className="text-sm text-[#1DB954]">{successMessage}</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full cursor-pointer rounded-full bg-[#1DB954] px-8 py-3 font-bold text-black transition-colors hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
