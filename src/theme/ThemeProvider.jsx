import { ThemePreferenceContextProvider, useThemePreference } from './ThemePreferenceContext.jsx';

export function ThemeProvider({ children }) {
  return (
    <ThemePreferenceContextProvider adminThemeActive>
      {children}
    </ThemePreferenceContextProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useThemePreference();
}
