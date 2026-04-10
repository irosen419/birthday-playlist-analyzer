import { useState, useCallback } from 'react';
import type { GenerationConfig } from '../../hooks/useAutoSave';

const MIN_RATIO = 10;
const MAX_RATIO = 60;
const RATIO_STEP = 5;
const MIN_SONG_COUNT = 50;
const MAX_SONG_COUNT = 200;
const SONG_COUNT_STEP = 5;
const TARGET_RATIO_SUM = 100;

interface PlaylistConfigProps {
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
}

function toPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

function toRatio(percent: number): number {
  return percent / 100;
}

function ratioSumIsValid(
  favorites: number,
  discovery: number,
  eraHits: number
): boolean {
  return favorites + discovery + eraHits === TARGET_RATIO_SUM;
}

export default function PlaylistConfig({
  config,
  onChange,
}: PlaylistConfigProps) {
  const [isOpen, setIsOpen] = useState(false);

  const favoritesPercent = toPercent(config.favoritesRatio);
  const discoveryPercent = toPercent(config.discoveryRatio);
  const eraHitsPercent = toPercent(config.eraHitsRatio);
  const currentSum = favoritesPercent + discoveryPercent + eraHitsPercent;
  const isValid = ratioSumIsValid(
    favoritesPercent,
    discoveryPercent,
    eraHitsPercent
  );

  const updateConfig = useCallback(
    (updates: Partial<GenerationConfig>) => {
      onChange({ ...config, ...updates });
    },
    [config, onChange]
  );

  const handleBalance = useCallback(() => {
    const total =
      toPercent(config.favoritesRatio) +
      toPercent(config.discoveryRatio) +
      toPercent(config.eraHitsRatio);

    if (total === TARGET_RATIO_SUM) return;

    const diff = TARGET_RATIO_SUM - toPercent(config.favoritesRatio);
    const halfDiff = Math.floor(diff / 2);
    const remainder = diff - halfDiff;

    onChange({
      ...config,
      discoveryRatio: toRatio(halfDiff),
      eraHitsRatio: toRatio(remainder),
    });
  }, [config, onChange]);

  return (
    <div className="mb-6 rounded-xl bg-[#181818]">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-[#b3b3b3]">
          Generation Settings
        </span>
        <span
          className={`text-[#6a6a6a] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          &#9660;
        </span>
      </button>

      {isOpen && (
        <div className="space-y-4 px-6 pb-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <RatioInput
              label="Favorites %"
              value={favoritesPercent}
              onChange={(val) =>
                updateConfig({ favoritesRatio: toRatio(val) })
              }
            />
            <RatioInput
              label="Discovery %"
              value={discoveryPercent}
              onChange={(val) =>
                updateConfig({ discoveryRatio: toRatio(val) })
              }
            />
            <RatioInput
              label="Era Hits %"
              value={eraHitsPercent}
              onChange={(val) =>
                updateConfig({ eraHitsRatio: toRatio(val) })
              }
            />
            <SongCountInput
              value={config.targetSongCount}
              onChange={(val) => updateConfig({ targetSongCount: val })}
            />
          </div>

          {!isValid && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-400">
                Ratios sum to {currentSum}% (must be 100%)
              </span>
              <button
                onClick={handleBalance}
                className="cursor-pointer rounded-lg border border-[#1DB954] bg-transparent px-3 py-1 text-xs text-[#1DB954] transition-colors hover:bg-[#1DB954] hover:text-black"
              >
                Balance
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RatioInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sync from parent when value changes externally (e.g., Balance button)
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(String(value));
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-[#6a6a6a]">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
          setLocalValue(raw);
          const num = parseInt(raw, 10);
          if (!isNaN(num)) {
            onChange(num);
          }
        }}
        onBlur={() => {
          const num = parseInt(localValue, 10) || MIN_RATIO;
          const clamped = Math.min(Math.max(num, MIN_RATIO), MAX_RATIO);
          setLocalValue(String(clamped));
          onChange(clamped);
        }}
        className="w-full rounded-lg bg-[#282828] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#1DB954]"
      />
    </div>
  );
}

function SongCountInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  return (
    <div>
      <label className="mb-1 block text-xs text-[#6a6a6a]">Total Songs</label>
      <input
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
          setLocalValue(raw);
          const num = parseInt(raw, 10);
          if (!isNaN(num)) {
            onChange(num);
          }
        }}
        onBlur={() => {
          const num = parseInt(localValue, 10) || MIN_SONG_COUNT;
          const clamped = Math.min(Math.max(num, MIN_SONG_COUNT), MAX_SONG_COUNT);
          setLocalValue(String(clamped));
          onChange(clamped);
        }}
        className="w-full rounded-lg bg-[#282828] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#1DB954]"
      />
    </div>
  );
}
