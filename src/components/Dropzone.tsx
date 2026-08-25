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
      className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
        dragging
          ? 'border-[var(--color-accent)] bg-blue-50/60'
          : 'border-[var(--color-line)] bg-white'
      }`}
    >
      <p className="text-sm font-medium">Drop files here</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Up to {formatBytes(maxFileSize)} per file
      </p>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-4 rounded-lg border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium transition hover:border-gray-300"
      >
        Browse files
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
