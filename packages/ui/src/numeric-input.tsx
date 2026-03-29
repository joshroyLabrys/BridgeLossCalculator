'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from './input';

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur' | 'type'> {
  value: number;
  onCommit: (value: number) => void;
}

/**
 * Numeric input that holds local string state while the user types,
 * only committing to the store on blur or Enter. Prevents the
 * "snap-on-keystroke" problem caused by parseFloat round-trips.
 */
export function NumericInput({ value, onCommit, ...props }: NumericInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const lastCommitted = useRef(value);

  // Sync from external value changes (e.g. unit toggle, test bridge load)
  // but only when not focused — don't interrupt the user typing
  useEffect(() => {
    if (!focused && value !== lastCommitted.current) {
      setLocalValue(String(value));
      lastCommitted.current = value;
    }
  }, [value, focused]);

  const commit = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (isNaN(parsed)) {
      // Reset to last good value
      setLocalValue(String(value));
    } else {
      lastCommitted.current = parsed;
      onCommit(parsed);
    }
  }, [localValue, value, onCommit]);

  return (
    <Input
      type="number"
      value={focused ? localValue : String(value)}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => {
        setFocused(true);
        setLocalValue(String(value));
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      {...props}
    />
  );
}

/* ─── Nullable variant (for optional fields like Yarnell K, sensitivity %) ─── */

interface NullableNumericInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur' | 'type'> {
  value: number | null;
  onCommit: (value: number | null) => void;
}

/**
 * Like NumericInput but supports null values. Empty input → commits null.
 */
export function NullableNumericInput({ value, onCommit, placeholder, ...props }: NullableNumericInputProps) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');
  const [focused, setFocused] = useState(false);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (!focused && value !== lastCommitted.current) {
      setLocalValue(value != null ? String(value) : '');
      lastCommitted.current = value;
    }
  }, [value, focused]);

  const commit = useCallback(() => {
    if (localValue.trim() === '') {
      lastCommitted.current = null;
      onCommit(null);
    } else {
      const parsed = parseFloat(localValue);
      if (isNaN(parsed)) {
        setLocalValue(value != null ? String(value) : '');
      } else {
        lastCommitted.current = parsed;
        onCommit(parsed);
      }
    }
  }, [localValue, value, onCommit]);

  return (
    <Input
      type="number"
      value={focused ? localValue : (value != null ? String(value) : '')}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => {
        setFocused(true);
        setLocalValue(value != null ? String(value) : '');
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      {...props}
    />
  );
}
