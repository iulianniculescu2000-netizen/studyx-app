import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import AccessibleButton from './AccessibleButton';

const meta = {
  title: 'UI/Button',
  component: AccessibleButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Accessible button component with multiple variants and loading states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
      description: 'Button visual variant',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Show loading state',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable button',
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: 'Make button full width',
    },
    children: {
      control: { type: 'text' },
      description: 'Button content',
    },
  },
  args: {
    children: 'Click me',
    onClick: fn(),
  },
} satisfies Meta<typeof AccessibleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default button
export const Default: Story = {
  args: {
    children: 'Default Button',
  },
};

// Variants
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
    children: 'Medium Button',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

// States
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
  parameters: {
    layout: 'padded',
  },
};

// With icons (simulated with text)
export const WithLeftIcon: Story = {
  args: {
    leftIcon: '<<',
    children: 'With Left Icon',
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: '>>',
    children: 'With Right Icon',
  },
};

export const WithBothIcons: Story = {
  args: {
    leftIcon: '<<',
    rightIcon: '>>',
    children: 'With Both Icons',
  },
};

// Interactive examples
export const Interactive: Story = {
  args: {
    children: 'Interactive Button',
  },
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

// Responsive examples
export const Responsive: Story = {
  args: {
    children: 'Responsive Button',
    fullWidth: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    layout: 'padded',
  },
};

// Accessibility examples
export const WithAriaLabel: Story = {
  args: {
    'aria-label': 'Submit form',
    children: 'Submit',
  },
};

export const WithAriaDescribedBy: Story = {
  args: {
    'aria-describedby': 'button-help',
    children: 'Learn More',
  },
  render: (args) => (
    <div>
      <p id="button-help">Click to learn more about this feature</p>
      <AccessibleButton {...args} />
    </div>
  ),
};
