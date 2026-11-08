import { ThemePreferenceContextProvider } from './ThemePreferenceContext.jsx';

export default function ThemePreferenceScope({ children }) {
  return (
    <ThemePreferenceContextProvider>
      {children}
    </ThemePreferenceContextProvider>
  );
}
