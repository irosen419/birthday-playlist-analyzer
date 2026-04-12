import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { GenerationConfig } from '../../hooks/useAutoSave';
import { areRatiosValid } from '../../lib/ratioValidation';

const MIN_RATIO = 0;
const MAX_RATIO = 100;
const MIN_SONG_COUNT = 30;
const MAX_SONG_COUNT = 200;
const TARGET_RATIO_SUM = 100;
const IDLE_WINDOW_MS = 10_000;

type RatioField = 'favorites' | 'discovery' | 'eraHits';

const RATIO_FIELD_ORDER: readonly RatioField[] = [
  'favorites',
  'discovery',
  'eraHits',
];

type TouchTimestamps = Record<RatioField, number>;

const INITIAL_TOUCH_TIMESTAMPS: TouchTimestamps = {
  favorites: 0,
  discovery: 0,
  eraHits: 0,
};

export interface PlaylistConfigHandle {
  commitPendingValues: () => Partial<GenerationConfig>;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface InputCommitHandle {
  commit: () => number;
}

const PlaylistConfig = forwardRef<PlaylistConfigHandle, PlaylistConfigProps>(
  function PlaylistConfig({ config, onChange }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [lastTouchedAt, setLastTouchedAt] = useState<TouchTimestamps>(
      INITIAL_TOUCH_TIMESTAMPS
    );

    const favoritesRef = useRef<InputCommitHandle>(null);
    const discoveryRef = useRef<InputCommitHandle>(null);
    const eraHitsRef = useRef<InputCommitHandle>(null);
    const songCountRef = useRef<InputCommitHandle>(null);

    useImperativeHandle(ref, () => ({
      commitPendingValues(): Partial<GenerationConfig> {
        const overrides: Partial<GenerationConfig> = {};
        if (favoritesRef.current) {
          overrides.favoritesRatio = toRatio(favoritesRef.current.commit());
        }
        if (discoveryRef.current) {
          overrides.discoveryRatio = toRatio(discoveryRef.current.commit());
        }
        if (eraHitsRef.current) {
          overrides.eraHitsRatio = toRatio(eraHitsRef.current.commit());
        }
        if (songCountRef.current) {
          overrides.targetSongCount = songCountRef.current.commit();
        }
        return overrides;
      },
    }));

    const favoritesPercent = toPercent(config.favoritesRatio);
    const discoveryPercent = toPercent(config.discoveryRatio);
    const eraHitsPercent = toPercent(config.eraHitsRatio);
    const currentSum = favoritesPercent + discoveryPercent + eraHitsPercent;
    const isValid = areRatiosValid(config);

    const updateConfig = useCallback(
      (updates: Partial<GenerationConfig>) => {
        onChange({ ...config, ...updates });
      },
      [config, onChange]
    );

    const touchRatioField = useCallback((field: RatioField) => {
      const now = Date.now();
      setLastTouchedAt((prev) => ({ ...prev, [field]: now }));
    }, []);

    const handleBalance = useCallback(() => {
      const currentPercents: Record<RatioField, number> = {
        favorites: toPercent(config.favoritesRatio),
        discovery: toPercent(config.discoveryRatio),
        eraHits: toPercent(config.eraHitsRatio),
      };

      const now = Date.now();
      const idleFields = RATIO_FIELD_ORDER.filter(
        (field) => now - lastTouchedAt[field] >= IDLE_WINDOW_MS
      );

      if (idleFields.length === 0) return;

      const lockedSum = RATIO_FIELD_ORDER.filter(
        (field) => !idleFields.includes(field)
      ).reduce((sum, field) => sum + currentPercents[field], 0);

      const remainder = TARGET_RATIO_SUM - lockedSum;
      if (remainder < 0) return;

      const base = Math.floor(remainder / idleFields.length);
      const leftover = remainder - base * idleFields.length;

      const nextPercents: Record<RatioField, number> = { ...currentPercents };
      idleFields.forEach((field, index) => {
        nextPercents[field] = base + (index < leftover ? 1 : 0);
      });

      onChange({
        ...config,
        favoritesRatio: toRatio(nextPercents.favorites),
        discoveryRatio: toRatio(nextPercents.discovery),
        eraHitsRatio: toRatio(nextPercents.eraHits),
      });
    }, [config, lastTouchedAt, onChange]);

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
                ref={favoritesRef}
                label="Favorites %"
                value={favoritesPercent}
                onCommit={(val) =>
                  updateConfig({ favoritesRatio: toRatio(val) })
                }
                onTouch={() => touchRatioField('favorites')}
              />
              <RatioInput
                ref={discoveryRef}
                label="Discovery %"
                value={discoveryPercent}
                onCommit={(val) =>
                  updateConfig({ discoveryRatio: toRatio(val) })
                }
                onTouch={() => touchRatioField('discovery')}
              />
              <RatioInput
                ref={eraHitsRef}
                label="Era Hits %"
                value={eraHitsPercent}
                onCommit={(val) =>
                  updateConfig({ eraHitsRatio: toRatio(val) })
                }
                onTouch={() => touchRatioField('eraHits')}
              />
              <SongCountInput
                ref={songCountRef}
                value={config.targetSongCount}
                onCommit={(val) => updateConfig({ targetSongCount: val })}
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
);

export default PlaylistConfig;

interface RatioInputProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  onTouch: () => void;
}

const RatioInput = forwardRef<InputCommitHandle, RatioInputProps>(
  function RatioInput({ label, value, onCommit, onTouch }, ref) {
    const [localValue, setLocalValue] = useState(String(value));
    const [prevValue, setPrevValue] = useState(value);

    if (value !== prevValue) {
      setPrevValue(value);
      setLocalValue(String(value));
    }

    const commitLocalValue = useCallback((): number => {
      const parsed = parseInt(localValue, 10);
      const fallback = isNaN(parsed) ? MIN_RATIO : parsed;
      const clamped = clamp(fallback, MIN_RATIO, MAX_RATIO);
      setLocalValue(String(clamped));
      onCommit(clamped);
      return clamped;
    }, [localValue, onCommit]);

    useImperativeHandle(ref, () => ({ commit: commitLocalValue }), [
      commitLocalValue,
    ]);

    const parsed = parseInt(localValue, 10);
    const overMax = !isNaN(parsed) && parsed > MAX_RATIO;

    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label className="block text-xs text-[#6a6a6a]">{label}</label>
          {overMax && (
            <span className="text-xs text-amber-400">Max is {MAX_RATIO}</span>
          )}
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={localValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
            setLocalValue(raw);
            onTouch();
          }}
          onBlur={commitLocalValue}
          className="w-full rounded-lg bg-[#282828] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#1DB954]"
        />
      </div>
    );
  }
);

interface SongCountInputProps {
  value: number;
  onCommit: (value: number) => void;
}

const SongCountInput = forwardRef<InputCommitHandle, SongCountInputProps>(
  function SongCountInput({ value, onCommit }, ref) {
    const [localValue, setLocalValue] = useState(String(value));
    const [prevValue, setPrevValue] = useState(value);

    if (value !== prevValue) {
      setPrevValue(value);
      setLocalValue(String(value));
    }

    const commitLocalValue = useCallback((): number => {
      const parsed = parseInt(localValue, 10);
      const fallback = isNaN(parsed) ? MIN_SONG_COUNT : parsed;
      const clamped = clamp(fallback, MIN_SONG_COUNT, MAX_SONG_COUNT);
      setLocalValue(String(clamped));
      onCommit(clamped);
      return clamped;
    }, [localValue, onCommit]);

    useImperativeHandle(ref, () => ({ commit: commitLocalValue }), [
      commitLocalValue,
    ]);

    const parsed = parseInt(localValue, 10);
    const overMax = !isNaN(parsed) && parsed > MAX_SONG_COUNT;

    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label className="block text-xs text-[#6a6a6a]">Total Songs</label>
          {overMax && (
            <span className="text-xs text-amber-400">
              Max is {MAX_SONG_COUNT}
            </span>
          )}
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={localValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
            setLocalValue(raw);
          }}
          onBlur={commitLocalValue}
          className="w-full rounded-lg bg-[#282828] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#1DB954]"
        />
      </div>
    );
  }
);
