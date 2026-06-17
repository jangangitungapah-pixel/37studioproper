
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = '37studioproper.theme.v1';

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  return getSystemTheme();
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => {
    function setTheme(nextTheme) {
      setThemeState(nextTheme === 'light' ? 'light' : 'dark');
    }

    function toggleTheme() {
      setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
    }

    return {
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme harus dipakai di dalam ThemeProvider.');
  }

  return value;
}
