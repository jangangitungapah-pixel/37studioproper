import { lazy, Suspense, useMemo } from 'react';
import { useTheme } from '../../theme/ThemeProvider.js';

const EChartsRenderer = lazy(() => import('./EChartsRenderer.jsx'));

const TOKEN_FALLBACKS = Object.freeze({
  '--studio-chart-1': '#e3a45c',
  '--studio-chart-2': '#83a7df',
  '--studio-chart-3': '#69bb98',
  '--studio-chart-4': '#d47f88',
  '--studio-chart-5': '#a296db',
  '--studio-chart-6': '#c5ad78',
  '--studio-text-primary': '#241b15',
  '--studio-text-secondary': '#5f5145',
  '--studio-text-tertiary': '#8a7b6d',
  '--studio-surface-floating': '#fffdf9',
  '--studio-edge-normal': 'rgba(55, 39, 26, 0.12)',
  '--studio-shadow-floating': '0 28px 70px rgba(61, 43, 27, 0.14)',
  '--ui-font-sans': 'Inter, sans-serif',
});

function readThemeToken(name) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return TOKEN_FALLBACKS[name] || '';
  }

  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    || TOKEN_FALLBACKS[name]
    || '';
}

function resolveCssVariables(value) {
  if (typeof value === 'string') {
    return value.replace(/var\((--[\w-]+)\)/g, (match, token) => readThemeToken(token) || match);
  }

  if (Array.isArray(value)) return value.map(resolveCssVariables);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveCssVariables(entry)]));
  }

  return value;
}

export default function StudioChart({
  ariaLabel = 'Grafik data',
  className = '',
  height = 240,
  option,
}) {
  const { resolvedTheme } = useTheme();

  const resolvedOption = useMemo(() => {
    const theme = {
      color: [
        readThemeToken('--studio-chart-1'),
        readThemeToken('--studio-chart-2'),
        readThemeToken('--studio-chart-3'),
        readThemeToken('--studio-chart-4'),
        readThemeToken('--studio-chart-5'),
        readThemeToken('--studio-chart-6'),
      ],
      backgroundColor: 'transparent',
      textStyle: {
        color: readThemeToken('--studio-text-secondary'),
        fontFamily: readThemeToken('--ui-font-sans'),
      },
      tooltip: {
        backgroundColor: readThemeToken('--studio-surface-floating'),
        borderColor: readThemeToken('--studio-edge-normal'),
        borderWidth: 1,
        textStyle: { color: readThemeToken('--studio-text-primary') },
        extraCssText: 'box-shadow: ' + readThemeToken('--studio-shadow-floating') + '; border-radius: 12px;',
      },
    };
    const supplied = resolveCssVariables(option || {});

    return {
      ...theme,
      ...supplied,
      textStyle: { ...theme.textStyle, ...supplied.textStyle },
      tooltip: { ...theme.tooltip, ...supplied.tooltip },
    };
  }, [option, resolvedTheme]);

  return (
    <div aria-label={ariaLabel} className={['studio-chart', className].filter(Boolean).join(' ')} role="img">
      <Suspense fallback={<div aria-live="polite" className="studio-chart-loading" role="status">Memuat grafik…</div>}>
        <EChartsRenderer height={height} option={resolvedOption} />
      </Suspense>
    </div>
  );
}
