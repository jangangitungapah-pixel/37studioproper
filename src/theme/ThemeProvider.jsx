import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  getInitialThemePreference,
  getSystemTheme,
  isThemePreference,
  resolveThemePreference,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from './themePreferences.js';

const ThemeContext =
  createContext(
    null,
  );

const THEME_META_COLORS =
  Object.freeze({
    [THEME_PREFERENCES.DARK]:
      '#100E0C',

    [THEME_PREFERENCES.LIGHT]:
      '#F2EEE7',
  });

export function ThemeProvider({
  children,
}) {
  const [
    preference,
    setPreference,
  ] =
    useState(
      getInitialThemePreference,
    );

  const [
    systemTheme,
    setSystemTheme,
  ] =
    useState(
      getSystemTheme,
    );

  const documentSnapshotRef =
    useRef(
      null,
    );

  const resolvedTheme =
    resolveThemePreference(
      preference,
      systemTheme,
    );

  useLayoutEffect(() => {
    if (
      typeof document ===
      'undefined'
    ) {
      return undefined;
    }

    const root =
      document.documentElement;

    const themeColorMeta =
      document.querySelector(
        'meta[name="theme-color"]',
      );

    documentSnapshotRef.current = {
      adminThemeActive:
        root.dataset
          .adminThemeActive,

      colorScheme:
        root.style
          .colorScheme,

      theme:
        root.dataset
          .theme,

      themeColor:
        themeColorMeta?.getAttribute(
          'content',
        ) || '',
    };

    root.dataset.adminThemeActive =
      'true';

    return () => {
      const snapshot =
        documentSnapshotRef.current;

      if (!snapshot) {
        return;
      }

      if (
        snapshot.theme
      ) {
        root.dataset.theme =
          snapshot.theme;
      } else {
        delete root.dataset.theme;
      }

      if (
        snapshot.adminThemeActive
      ) {
        root.dataset.adminThemeActive =
          snapshot.adminThemeActive;
      } else {
        delete root.dataset
          .adminThemeActive;
      }

      root.style.colorScheme =
        snapshot.colorScheme ||
        '';

      if (
        themeColorMeta &&
        snapshot.themeColor
      ) {
        themeColorMeta.setAttribute(
          'content',
          snapshot.themeColor,
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      typeof window ===
      'undefined' ||
      !window.matchMedia
    ) {
      return undefined;
    }

    const media =
      window.matchMedia(
        '(prefers-color-scheme: dark)',
      );

    function syncSystemTheme(
      event,
    ) {
      setSystemTheme(
        event.matches
          ? THEME_PREFERENCES.DARK
          : THEME_PREFERENCES.LIGHT,
      );
    }

    if (
      typeof media.addEventListener ===
      'function'
    ) {
      media.addEventListener(
        'change',
        syncSystemTheme,
      );

      return () => {
        media.removeEventListener(
          'change',
          syncSystemTheme,
        );
      };
    }

    media.addListener?.(
      syncSystemTheme,
    );

    return () => {
      media.removeListener?.(
        syncSystemTheme,
      );
    };
  }, []);

  useLayoutEffect(() => {
    if (
      typeof document !==
      'undefined'
    ) {
      document.documentElement
        .dataset.theme =
        resolvedTheme;

      document.documentElement
        .style.colorScheme =
        resolvedTheme;

      document.querySelector(
        'meta[name="theme-color"]',
      )?.setAttribute(
        'content',
        THEME_META_COLORS[
          resolvedTheme
        ],
      );
    }
  }, [
    resolvedTheme,
  ]);

  useEffect(() => {
    if (
      typeof window !==
      'undefined'
    ) {
      try {
        window.localStorage.setItem(
          THEME_STORAGE_KEY,
          preference,
        );
      } catch {
        // Storage may be blocked.
      }
    }
  }, [
    preference,
  ]);

  const value =
    useMemo(
      () => {
        function setTheme(
          nextPreference,
        ) {
          setPreference(
            isThemePreference(
              nextPreference,
            )
              ? nextPreference
              : THEME_PREFERENCES.LIGHT,
          );
        }

        function toggleTheme() {
          setPreference(
            resolvedTheme ===
              THEME_PREFERENCES.DARK
              ? THEME_PREFERENCES.LIGHT
              : THEME_PREFERENCES.DARK,
          );
        }

        return {
          isDark:
            resolvedTheme ===
            THEME_PREFERENCES.DARK,

          preference,

          resolvedTheme,

          setTheme,

          systemTheme,

          theme:
            resolvedTheme,

          toggleTheme,
        };
      },
      [
        preference,
        resolvedTheme,
        systemTheme,
      ],
    );

  return (
    <ThemeContext.Provider
      value={
        value
      }
    >
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const value =
    useContext(
      ThemeContext,
    );

  if (!value) {
    throw new Error(
      'useTheme harus dipakai di dalam ThemeProvider.',
    );
  }

  return value;
}
