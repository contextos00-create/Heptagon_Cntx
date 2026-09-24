import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import './index.css';
import { MantineProvider } from '@mantine/core';
import { mantineThemeForMode } from './theme/mantineTheme';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeMode, isDarkTheme } from './types/surface';

const THEME_KEY = 'heptasurface_theme_v2';

function readInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'hepta-dark') return saved;
    const legacy = localStorage.getItem('heptasurface_theme_v1');
    if (legacy === 'dark' || legacy === 'light') return legacy;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyDocumentTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('dark', 'skin-hepta-dark');
  if (theme === 'dark') root.classList.add('dark');
  if (theme === 'hepta-dark') root.classList.add('dark', 'skin-hepta-dark');
  root.setAttribute('data-theme', theme);
}

function Root() {
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());

  useEffect(() => {
    applyDocumentTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // App toggles theme by writing localStorage + dispatching this event
  useEffect(() => {
    const onTheme = (e: Event) => {
      const next = (e as CustomEvent<ThemeMode>).detail;
      if (next === 'light' || next === 'dark' || next === 'hepta-dark') {
        setTheme(next);
      }
    };
    window.addEventListener('hepta-theme-change', onTheme as EventListener);
    return () => window.removeEventListener('hepta-theme-change', onTheme as EventListener);
  }, []);

  const mantineTheme = useMemo(() => mantineThemeForMode(theme), [theme]);

  return (
    <MantineProvider
      theme={mantineTheme}
      forceColorScheme={isDarkTheme(theme) ? 'dark' : 'light'}
    >
      <RouterProvider router={router} />
    </MantineProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
