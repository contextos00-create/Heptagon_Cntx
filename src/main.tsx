import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import './index.css';
import { MantineProvider } from '@mantine/core';
import { mantineTheme } from './theme/mantineTheme';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <RouterProvider router={router} />
    </MantineProvider>
  </StrictMode>,
);
