import type { StorybookConfig } from '@storybook/test-runner';

const config: StorybookConfig = {
  // Directory to search for stories
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  
  // Addons configuration
  addons: {
    '@storybook/addon-essentials': {},
  },
  
  // Framework configuration
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  
  // Test runner configuration
  testRunner: {
    // Directory to store test artifacts
    outputDir: 'tests/visual/output',
    
    // URL to your Storybook instance
    url: 'http://localhost:6006',
    
    // Number of concurrent tests
    concurrency: 4,
    
    // Timeout for each test (in milliseconds)
    timeout: 60000,
    
    // Retry failed tests
    retry: 2,
    
    // Viewports to test
    viewports: [
      {
        name: 'mobile',
        width: 375,
        height: 667,
      },
      {
        name: 'tablet',
        width: 768,
        height: 1024,
      },
      {
        name: 'desktop',
        width: 1920,
        height: 1080,
      },
    ],
    
    // Target browsers
    browsers: ['chromium', 'firefox', 'webkit'],
    
    // Threshold for pixel difference (0-1)
    diffThreshold: 0.01,
    
    // Skip stories that match these patterns
    skip: [
      '**/*.stories.*',
      'src/components/**/stories/**',
    ],
    
    // Only test stories that match these patterns
    only: [
      'src/components/**/*.stories.@(js|jsx|ts|tsx)',
    ],
    
    // Configuration for visual diff
    diffConfig: {
      // Image comparison algorithm
      algorithm: 'pixelmatch',
      
      // Threshold for color differences
      threshold: 0.1,
      
      // Include anti-aliased pixels
      includeAA: true,
      
      // Ignore transparent pixels
      ignoreTransparent: true,
      
      // Highlight differences in output
      highlightDiff: true,
    },
    
    // Configuration for screenshots
    screenshotOptions: {
      // Capture full page
      fullPage: true,
      
      // Wait for animations to complete
      animations: 'disabled',
      
      // CSS media features
      mediaFeatures: [
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-color-scheme', value: 'dark' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    },
    
    // Custom hooks
    hooks: {
      // Before all tests
      setup: async () => {
        console.log('Starting visual regression tests...');
      },
      
      // After all tests
      teardown: async () => {
        console.log('Visual regression tests completed.');
      },
      
      // Before each test
      beforeEach: async (context) => {
        // Clear any local storage or state
        await context.page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      },
      
      // After each test
      afterEach: async (context) => {
        // Take additional debugging screenshots if test failed
        if (context.testResult.status === 'failed') {
          await context.page.screenshot({
            path: `tests/visual/debug/${context.titleId}-debug.png`,
            fullPage: true,
          });
        }
      },
    },
    
    // Environment variables
    env: {
      NODE_ENV: 'test',
      CI: process.env.CI || 'false',
    },
    
    // Custom reporters
    reporters: [
      // HTML report
      ['html', { outputDir: 'tests/visual/report' }],
      
      // JSON report for CI
      ['json', { outputFile: 'tests/visual/results.json' }],
      
      // JUnit report for CI systems
      ['junit', { outputFile: 'tests/visual/junit.xml' }],
      
      // Console output
      'summary',
    ],
    
    // Configuration for specific components
    componentPatterns: {
      // Test all button variants
      'Button': {
        viewports: ['mobile', 'tablet', 'desktop'],
        variants: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
        states: ['default', 'hover', 'active', 'disabled'],
      },
      
      // Test input components with different states
      'Input': {
        viewports: ['mobile', 'desktop'],
        variants: ['default', 'error', 'success'],
        states: ['default', 'focus', 'disabled'],
      },
      
      // Test modal components
      'Modal': {
        viewports: ['mobile', 'desktop'],
        variants: ['default', 'large', 'small'],
        states: ['open', 'closed'],
      },
      
      // Test theme changes
      'ThemeToggle': {
        viewports: ['desktop'],
        variants: ['light', 'dark', 'auto'],
        states: ['default', 'hover'],
      },
      
      // Test loading states
      'Loading': {
        viewports: ['mobile', 'desktop'],
        variants: ['spinner', 'skeleton', 'progress'],
        states: ['default', 'loading', 'complete'],
      },
    },
    
    // Skip stories that are known to be flaky
    knownFlakyStories: [
      'src/components/complex/Animation.stories.tsx',
      'src/components/charts/RealtimeChart.stories.tsx',
    ],
    
    // Performance monitoring
    performance: {
      // Warn if test takes longer than this (ms)
      warnThreshold: 30000,
      
      // Fail test if it takes longer than this (ms)
      failThreshold: 60000,
      
      // Monitor memory usage
      memory: {
        // Warn if memory usage exceeds this (MB)
        warnThreshold: 500,
        
        // Fail test if memory usage exceeds this (MB)
        failThreshold: 1000,
      },
    },
    
    // Accessibility testing
    accessibility: {
      // Run axe-core accessibility tests
      axe: {
        enabled: true,
        
        // Axe rules to ignore
        rules: {
          'color-contrast': { enabled: false }, // Handled by visual tests
          'keyboard-navigation': { enabled: true },
          'aria-labels': { enabled: true },
          'role-requirements': { enabled: true },
        },
        
        // Impact levels to test
        impactLevels: ['critical', 'serious'],
      },
    },
    
    // Integration with CI/CD
    ci: {
      // Generate artifacts for GitHub Actions
      githubActions: {
        enabled: true,
        
        // Upload screenshots as artifacts
        uploadScreenshots: true,
        
        // Generate pull request comments
        prComment: true,
        
        // Fail CI if visual tests fail
        failOnError: true,
      },
    },
  },
};

export default config;
