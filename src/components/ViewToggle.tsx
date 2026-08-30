'use client';

export type ViewMode = 'list' | 'grid';

export default function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex rounded-xl border border-line bg-surface p-1">
      {(['list', 'grid'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={mode === value}
          aria-label={`${value} view`}
          className={`flex h-7 w-8 items-center justify-center rounded-lg transition ${
            mode === value ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
            {value === 'list' ? (
              <>
                <rect x="1" y="2.5" width="14" height="2" rx="1" />
                <rect x="1" y="7" width="14" height="2" rx="1" />
                <rect x="1" y="11.5" width="14" height="2" rx="1" />
              </>
            ) : (
              <>
                <rect x="1" y="1" width="6" height="6" rx="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
              </>
            )}
          </svg>
        </button>
      ))}
    </div>
  );
}
