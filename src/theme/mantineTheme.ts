import { createTheme, MantineThemeOverride } from '@mantine/core';
import { ThemeMode } from '../types/surface';

const baseComponents: MantineThemeOverride['components'] = {
  Button: {
    defaultProps: {
      size: 'xs',
      radius: 'md',
    },
  },
  ActionIcon: {
    defaultProps: {
      size: 'sm',
      radius: 'md',
      variant: 'subtle',
    },
  },
  Tooltip: {
    defaultProps: {
      withArrow: true,
      arrowSize: 4,
      openDelay: 200,
      radius: 'sm',
    },
  },
  Badge: {
    defaultProps: {
      size: 'xs',
      radius: 'sm',
    },
  },
  Modal: {
    defaultProps: {
      radius: 'lg',
      overlayProps: {
        backgroundOpacity: 0.55,
        blur: 4,
      },
    },
  },
};

/** Default Heptasurface chrome (orange accent) */
export const mantineTheme = createTheme({
  primaryColor: 'orange',
  fontFamily: 'IBM Plex Sans, ui-sans-serif, system-ui, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: baseComponents,
});

/**
 * Hepta Dark skin — mirrors contextos00-create/Hepta_dark
 * Cyan/sky primary, sharper radii, technical mono feel.
 */
export const mantineHeptaDarkTheme = createTheme({
  primaryColor: 'cyan',
  fontFamily: 'IBM Plex Sans, Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
  defaultRadius: 'xs',
  cursorType: 'pointer',
  components: {
    ...baseComponents,
    Button: {
      defaultProps: {
        size: 'xs',
        radius: 'xs',
      },
    },
    ActionIcon: {
      defaultProps: {
        size: 'sm',
        radius: 'xs',
        variant: 'subtle',
      },
    },
    Badge: {
      defaultProps: {
        size: 'xs',
        radius: 'xs',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'sm',
        overlayProps: {
          backgroundOpacity: 0.65,
          blur: 6,
        },
      },
    },
  },
});

export function mantineThemeForMode(mode: ThemeMode) {
  return mode === 'hepta-dark' ? mantineHeptaDarkTheme : mantineTheme;
}
