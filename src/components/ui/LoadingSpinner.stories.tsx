import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { LoadingSpinner, QuizLoadingState, AIProcessingState, DataLoadingState, ButtonLoadingState } from './LoadingSpinner';

const meta = {
  title: 'UI/LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Loading spinner components with multiple variants and states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Spinner size',
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'dots', 'pulse', 'ai'],
      description: 'Spinner animation variant',
    },
    text: {
      control: { type: 'text' },
      description: 'Optional loading text',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default spinner
export const Default: Story = {
  args: {
    size: 'md',
    variant: 'default',
  },
};

// Variants
export const Dots: Story = {
  args: {
    size: 'md',
    variant: 'dots',
  },
};

export const Pulse: Story = {
  args: {
    size: 'md',
    variant: 'pulse',
  },
};

export const AI: Story = {
  args: {
    size: 'md',
    variant: 'ai',
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    variant: 'default',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
    variant: 'default',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    variant: 'default',
  },
};

// With text
export const WithText: Story = {
  args: {
    size: 'md',
    variant: 'default',
    text: 'Loading...',
  },
};

export const WithCustomText: Story = {
  args: {
    size: 'lg',
    variant: 'ai',
    text: 'AI is thinking...',
  },
};

// Predefined loading states
export const QuizLoading: Story = {
  render: () => <QuizLoadingState />,
  parameters: {
    docs: {
      description: {
        story: 'Loading state for quiz pages.',
      },
    },
  },
};

export const AIProcessing: Story = {
  render: () => <AIProcessingState />,
  parameters: {
    docs: {
      description: {
        story: 'Loading state for AI processing.',
      },
    },
  },
};

export const DataLoading: Story = {
  render: () => <DataLoadingState message="Loading your data..." />,
  parameters: {
    docs: {
      description: {
        story: 'General data loading state.',
      },
    },
  },
};

export const ButtonLoading: Story = {
  render: () => <ButtonLoadingState text="Processing..." />,
  parameters: {
    docs: {
      description: {
        story: 'Loading state for buttons.',
      },
    },
  },
};

// Interactive examples
export const Interactive: Story = {
  args: {
    size: 'md',
    variant: 'ai',
    text: 'Click to start loading',
  },
  render: (args) => {
    const [isLoading, setIsLoading] = React.useState(false);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 3000);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            background: '#f0f0f0',
            cursor: 'pointer'
          }}
        >
          {isLoading ? 'Loading...' : 'Start Loading'}
        </button>
        {isLoading && <LoadingSpinner {...args} text="Loading data..." />}
      </div>
    );
  },
};

// Dark mode testing
export const DarkMode: Story = {
  args: {
    size: 'lg',
    variant: 'ai',
    text: 'Loading in dark mode...',
  },
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
};

// Responsive examples
export const Responsive: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <LoadingSpinner size="sm" variant="default" />
        <LoadingSpinner size="md" variant="default" />
        <LoadingSpinner size="lg" variant="default" />
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <LoadingSpinner size="sm" variant="dots" text="Small" />
        <LoadingSpinner size="md" variant="dots" text="Medium" />
        <LoadingSpinner size="lg" variant="dots" text="Large" />
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <LoadingSpinner size="sm" variant="ai" />
        <LoadingSpinner size="md" variant="ai" />
        <LoadingSpinner size="lg" variant="ai" />
      </div>
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
