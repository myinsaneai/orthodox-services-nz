// src/admin/AvatarDropzone.tsx
// Drag a picture onto the box, or click it / press Enter to choose a file.
// It only hands the chosen file on; the page decides what to do with it.

import { useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';

export default function AvatarDropzone({ onFile, disabled }: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const choose = () => { if (!disabled) input.current?.click(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && !disabled) onFile(file);
  };

  return (
    <div
      className={`dz${over ? ' dz--over' : ''}${disabled ? ' dz--disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Photo: drop a picture here, or press Enter to choose one"
      onClick={choose}
      onKeyDown={onKey}
      onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        aria-label="Choose a photo file"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';                    // lets the same file be chosen again
          if (file) onFile(file);
        }}
      />
      <strong>Drop a photo here</strong>
      <span>or click to choose one</span>
      <small>JPEG, PNG, WebP or GIF. Pictures larger than 1024 px are made smaller automatically.</small>
    </div>
  );
}
