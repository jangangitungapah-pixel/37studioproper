
import { Moon, Sparkles, SunMedium } from 'lucide-react';
import { ThemeContainer } from './theme/ThemeContainer.jsx';
import { ThemeProvider, useTheme } from './theme/ThemeProvider.jsx';

function FoundationPage() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <ThemeContainer>
      <main className="min-h-dvh bg-[var(--ui-bg-page)] px-5 py-8 text-[var(--ui-text-main)]">
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl place-items-center">
          <div className="w-full max-w-xl rounded-[2rem] border border-[var(--ui-border)] bg-[var(--ui-surface-card)] p-7 shadow-[var(--ui-shadow-soft)] backdrop-blur-2xl sm:p-10">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--ui-accent),var(--ui-accent-strong))] text-white shadow-[0_18px_45px_rgba(255,104,28,0.28)]">
                <Sparkles size={26} />
              </div>

              <button
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-control)] px-4 text-sm font-bold text-[var(--ui-text-main)] transition hover:-translate-y-0.5"
                type="button"
                onClick={toggleTheme}
              >
                {isDark ? <SunMedium size={17} /> : <Moon size={17} />}
                {isDark ? 'Light' : 'Dark'}
              </button>
            </div>

            <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[var(--ui-accent)]">
              Foundation Ready
            </p>

            <h1 className="mb-4 text-4xl font-black tracking-[-0.06em] text-[var(--ui-text-strong)] sm:text-5xl">
              37 Studio Proper
            </h1>

            <p className="max-w-prose text-base leading-7 text-[var(--ui-text-muted)]">
              React, Vite, Tailwind, token CSS, ThemeProvider, dan ThemeContainer sudah siap.
              Setelah ini baru kita pasang login page dan cangkang admin.
            </p>
          </div>
        </section>
      </main>
    </ThemeContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FoundationPage />
    </ThemeProvider>
  );
}
