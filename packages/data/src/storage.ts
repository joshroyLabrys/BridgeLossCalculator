const NS = 'flowsuite';

function key(name: string): string {
  return `${NS}:${name}`;
}

export function getStorage<T>(name: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStorage<T>(name: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // Storage full or unavailable
  }
}

export function removeStorage(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key(name));
}

export function listStorageKeys(prefix: string): string[] {
  if (typeof window === 'undefined') return [];
  const fullPrefix = key(prefix);
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(fullPrefix)) keys.push(k.slice(NS.length + 1));
  }
  return keys;
}
