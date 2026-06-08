import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'release',
    'node_modules',
    '.claude',
    'studyx-updates',
    'studyx-updates-temp',
    'Und',
    'src/components/chat/**',
    'src/components/collaboration/**',
    'src/components/update/**',
    'src/lib/ai/**',
    'src/utils/lazyLoad.tsx',
    'src/utils/memoryProfiler.ts',
    'src/utils/serviceWorker.ts',
    'src/components/StabilityTimelineSimple.tsx',
    'src/hooks/useStabilityMonitor.ts',
    'src/hooks/useUIManager.ts',
    'src/pages/KnowledgeVault.tsx',
    'src/pages/quiz-play/QuizPlayRefactored.tsx',
    'src/components/quiz/**',
    'src/components/sidebar/**',
    'src/components/stats/ActivityHeatmap.tsx',
    'src/components/stats/StatsOverview.tsx',
    'src/components/ui/**',
    'src/helpers/errors.ts',
    'src/hooks/useKeyboardShortcuts.tsx',
    'src/hooks/usePerformanceOptimizer.ts',
    'tests/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
