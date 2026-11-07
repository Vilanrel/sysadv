export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'sysadv.ui.theme';

export function readTheme(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

/** 'system' remove o atributo e deixa o CSS seguir prefers-color-scheme. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try { window.localStorage.setItem(KEY, choice); } catch { /* segue sem persistir */ }
}

export function applyStoredTheme() { applyTheme(readTheme()); }
