'use client';

import { useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';

interface Props {
  maxFileSize: number;
  onFiles: (files: File[]) => void;
}

export default function Dropzone({ maxFileSize, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed px-5 py-6 transition ${
        dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'
      }`}
    >
      <div>
        <p className="font-display text-base font-semibold">
          {dragging ? 'Drop to upload' : 'Drop files here'}
        </p>
        <p className="mt-1 font-mono text-[13px] text-ink-3">
          up to {formatBytes(maxFileSize)} each
        </p>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium transition hover:border-ink"
      >
        Choose files
      </button>

      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}
