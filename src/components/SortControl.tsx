'use client';

import type { SortField, SortOrder } from '@/lib/types';

const FIELDS: { value: SortField; label: string }[] = [
  { value: 'created', label: 'Added' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
];

interface Props {
  sort: SortField;
  order: SortOrder;
  onChange: (sort: SortField, order: SortOrder) => void;
}

export default function SortControl({ sort, order, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      {FIELDS.map((field) => {
        const active = sort === field.value;

        return (
          <button
            key={field.value}
            type="button"
            aria-pressed={active}
            // Clicking the field you are already sorted by flips the direction.
            onClick={() =>
              onChange(field.value, active && order === 'desc' ? 'asc' : active ? 'desc' : 'desc')
            }
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-xs transition ${
              active ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {field.label}
            {active && <span aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span>}
          </button>
        );
      })}
    </div>
  );
}
