/**
 * Jest Configuration - StudyX Testing Framework
 * Configurare completă pentru unit tests, integration tests și E2E
 */

const nextJest = require('next/jest');

const createJestConfig = (tsconfig) => {
  return {
    // Configurare de bază
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
    
    // Module resolution
    moduleNameMapping: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '^@components/(.*)$': '<rootDir>/src/components/$1',
      '^@pages/(.*)$': '<rootDir>/src/pages/$1',
      '^@store/(.*)$': '<rootDir>/src/store/$1',
      '^@helpers/(.*)$': '<rootDir>/src/helpers/$1',
      '^@lib/(.*)$': '<rootDir>/src/lib/$1',
      '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    },
    
    // Fișiere de test
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      '<rootDir>/test/**/*.{js,jsx,ts,tsx}',
    ],
    
    // Fișiere ignorate
    testPathIgnorePatterns: [
      '<rootDir>/node_modules/',
      '<rootDir>/.next/',
      '<rootDir>/dist/',
      '<rootDir>/build/',
      '<rootDir>/coverage/',
    ],
    
    // Coverage configuration
    collectCoverage: true,
    collectCoverageFrom: [
      'src/**/*.{js,jsx,ts,tsx}',
      '!src/**/*.d.ts',
      '!src/test/**',
      '!src/**/__tests__/**',
      '!src/**/*.stories.{js,jsx,ts,tsx}',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [
      'text',
      'lcov',
      'html',
      'json-summary',
    ],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      './src/helpers/': {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
      './src/store/': {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    
    // Transformări
    transform: {
      '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', 'babel-jest'],
    },
    transformIgnorePatterns: [
      'node_modules/(?!(framer-motion|lucide-react|@radix-ui)/)',
    ],
    
    // Mock-uri globale
    clearMocks: true,
    restoreMocks: true,
    resetMocks: true,
    
    // Environment variables
    globals: {
      'ts-jest': {
        tsconfig: tsconfig,
      },
    },
    
    // Reporter configuration
    verbose: true,
    reporters: [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: 'test-results',
          outputName: 'junit.xml',
          classNameTemplate: '{classname}',
          titleTemplate: '{title}',
          ancestorSeparator: ' › ',
          usePathForSuiteName: true,
        },
      ],
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Snapshot testing
    snapshotSerializers: [],
    
    // Performance
    maxWorkers: '50%',
    testSequencer: 'jest-junit',
    
    // Watch mode
    watchPlugins: [
      'jest-watch-typeahead/filename',
      'jest-watch-typeahead/testname',
    ],
    
    // Error handling
    errorOnDeprecated: true,
    notify: false,
    notifyMode: 'failure-change',
  };
};

module.exports = createJestConfig;
