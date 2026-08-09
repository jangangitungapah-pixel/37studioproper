import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ThemeContext =
  createContext(
    null,
  );

export const THEME_STORAGE_KEY =
  '37studioproper.theme.v1';

export const THEME_PREFERENCES =
  Object.freeze({
    DARK:
      'dark',

    LIGHT:
      'light',

    SYSTEM:
      'system',
  });

function isThemePreference(
  value,
) {
  return [
    THEME_PREFERENCES.DARK,
    THEME_PREFERENCES.LIGHT,
    THEME_PREFERENCES.SYSTEM,
  ].includes(
    value,
  );
}

export function getSystemTheme() {
  if (
    typeof window ===
    'undefined'
  ) {
    return THEME_PREFERENCES.LIGHT;
  }

  return window.matchMedia?.(
    '(prefers-color-scheme: dark)',
  ).matches
    ? THEME_PREFERENCES.DARK
    : THEME_PREFERENCES.LIGHT;
}

function readStoredThemePreference() {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  try {
    const stored =
      window.localStorage.getItem(
        THEME_STORAGE_KEY,
      );

    return isThemePreference(
      stored,
    )
      ? stored
      : null;
  } catch {
    return null;
  }
}

export function getInitialThemePreference() {
  return (
    readStoredThemePreference() ||
    THEME_PREFERENCES.LIGHT
  );
}

export function resolveThemePreference(
  preference,
  systemTheme,
) {
  if (
    preference ===
    THEME_PREFERENCES.SYSTEM
  ) {
    return systemTheme ===
      THEME_PREFERENCES.DARK
      ? THEME_PREFERENCES.DARK
      : THEME_PREFERENCES.LIGHT;
  }

  return preference ===
    THEME_PREFERENCES.DARK
    ? THEME_PREFERENCES.DARK
    : THEME_PREFERENCES.LIGHT;
}

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

  useEffect(() => {
    if (
      typeof document ===
      'undefined'
    ) {
      return undefined;
    }

    const root =
      document.documentElement;

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

    setSystemTheme(
      media.matches
        ? THEME_PREFERENCES.DARK
        : THEME_PREFERENCES.LIGHT,
    );

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

  useEffect(() => {
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
    }

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
    resolvedTheme,
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
