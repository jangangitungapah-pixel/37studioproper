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

export function isThemePreference(
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
