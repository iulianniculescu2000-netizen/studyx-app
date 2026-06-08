import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ThemeToggle, CompactThemeToggle, ThemeSelector } from './ThemeToggle';

const meta = {
  title: 'UI/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Theme toggle components with multiple variants and states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Toggle size',
    },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default theme toggle
export const Default: Story = {};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
  },
};

// Compact variant
export const Compact: Story = {
  render: () => <CompactThemeToggle />,
  parameters: {
    docs: {
      description: {
        story: 'Compact theme toggle for mobile or header use.',
      },
    },
  },
};

// Theme selector dropdown
export const Selector: Story = {
  render: () => <ThemeSelector />,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Full theme selector with dropdown menu.',
      },
    },
  },
};

// Interactive examples
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    if (!button) return;

    // Simulate hover
    button.dispatchEvent(new Event('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate click
    button.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate mouse leave
    button.dispatchEvent(new Event('mouseleave'));
  },
};

// Dark mode testing
export const DarkMode: Story = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
};

// Light mode testing
export const LightMode: Story = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
};

// Responsive examples
export const Responsive: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <ThemeToggle size="sm" />
      <ThemeToggle size="md" />
      <ThemeToggle size="lg" />
      <CompactThemeToggle />
    </div>
  ),
  parameters: {
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
};
