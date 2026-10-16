'use client';

import { suggestPlaces, tidyPlace } from '@neva/core';
import { MapPin, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '../store';

/**
 * Free-text location with search-style suggestions from anywhere in Nigeria.
 * Type any town, area or estate and keep it, or pick a suggestion.
 */
export function LocationInput({
  value,
  onChange,
  placeholder = 'City, town or area',
  variant = 'box',
  clearable,
  autoFocus,
  background,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  variant?: 'box' | 'field';
  clearable?: boolean;
  autoFocus?: boolean;
  background?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listId = useId();
  // Places already used on listings, so local spellings get reused.
  const used = useStore(useShallow((s) => Array.from(new Set(Object.values(s.listings).map((l) => l.city))).slice(0, 3)));
  const suggestions = useMemo(() => suggestPlaces(value, used, 8), [value, used]);
  const typed = value.trim();
  const exact = suggestions.some((p) => p.name.toLowerCase() === typed.toLowerCase());
  // "Use what you typed" goes first only when nothing in the list starts with it.
  const custom = typed.length >= 2 && !exact ? [{ name: tidyPlace(typed), region: 'Use what you typed', custom: true }] : [];
  const listed = suggestions.map((p) => ({ ...p, custom: false }));
  const close = listed.some((p) => p.name.toLowerCase().startsWith(typed.toLowerCase()));
  const options = close ? [...listed, ...custom] : [...custom, ...listed];

  const pick = (name: string) => {
    onChange(tidyPlace(name));
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <MapPin size={16} className="faint" style={{ position: 'absolute', left: variant === 'box' ? 12 : 8, top: 14, pointerEvents: 'none' }} />
      <input
        className={variant}
        style={{ paddingLeft: variant === 'box' ? 36 : 30, paddingRight: clearable && value ? 34 : undefined, background }}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (value.trim()) onChange(tidyPlace(value));
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) return setOpen(true);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && open && options[hi]) {
            e.preventDefault();
            pick(options[hi]!.name);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {clearable && value && (
        <button type="button" className="faint" style={{ position: 'absolute', right: 10, top: 13 }} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')} aria-label="Clear location">
          <X size={16} />
        </button>
      )}
      {open && options.length > 0 && (
        <div className="menu" role="listbox" id={listId} style={{ top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 300, overflowY: 'auto' }}>
          {!typed && <div className="faint" style={{ padding: '4px 18px 6px', fontSize: 12.5 }}>Popular — or type any town, area or estate</div>}
          {options.map((p, i) => (
            <button
              key={`${p.custom ? 'custom-' : ''}${p.name}`}
              type="button"
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(p.name)}
              style={{ background: i === hi ? 'var(--active)' : undefined }}>
              <MapPin size={15} className={p.custom ? '' : 'faint'} style={p.custom ? { color: 'var(--accent)' } : undefined} />
              <span className="grow ellipsis">{p.custom ? `“${p.name}”` : p.name}</span>
              <span className="faint" style={{ fontSize: 12.5 }}>{p.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
