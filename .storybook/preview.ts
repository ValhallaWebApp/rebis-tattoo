import type { Preview } from '@storybook/angular';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      test: 'error'
    },
    layout: 'centered',
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#f5f3ef' },
        { name: 'paper', value: '#ffffff' },
        { name: 'ink', value: '#1e1f23' }
      ]
    }
  }
};

export default preview;
