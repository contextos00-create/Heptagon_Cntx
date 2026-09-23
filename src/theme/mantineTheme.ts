import { createTheme } from '@mantine/core';

export const mantineTheme = createTheme({
  primaryColor: 'orange',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
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
  },
});
