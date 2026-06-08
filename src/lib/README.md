# Utility Libraries

## Overview

This directory contains utility libraries and helpers for the StudyX application.

## Active Libraries

### `aiContext.ts`
- Builds user context strings for AI prompts
- Performance summaries and study coach plans
- **Status**: ✅ Active and used

### `aiRequestGovernor.ts`
- Manages AI request queue and rate limiting
- Prevents API abuse and handles concurrency
- **Status**: ✅ Active and used

### `asyncGuard.ts`
- `createLatestOnlyRunner()`: Prevents race conditions in async operations
- `isDocumentHidden()`: Checks document visibility state
- **Status**: ⚠️ Partially used (only in DashboardAIStudyBuddy)

### `backgroundTaskQueue.ts`
- Queues background AI indexing tasks
- Handles task scheduling and retry logic
- **Status**: ✅ Active and used

### `groq.ts`
- Main AI API integration layer
- Question generation, explanations, chat functionality
- **Status**: ✅ Active and core to the app

### `idleTaskScheduler.ts`
- Schedules tasks during browser idle time
- Optimizes performance by deferring non-critical work
- **Status**: ✅ Active and used

### `idb.ts`
- IndexedDB wrapper for client-side storage
- Handles large data sets beyond localStorage limits
- **Status**: ✅ Active and used

### `pdfParser.ts`
- PDF text extraction using pdf-parse
- Handles document import functionality
- **Status**: ✅ Active and used

### `docxParser.ts`
- DOCX text extraction using mammoth
- Handles Word document imports
- **Status**: ✅ Active and used

### `ocrParser.ts`
- OCR text extraction from images using Tesseract.js
- Handles image-based document imports
- **Status**: ✅ Active and used

## Debug/Development Libraries

### `sm2Test.ts`
- SM-2 algorithm simulation and testing utility
- **Status**: 🧪 Debug only - Can be removed from production build
- **Usage**: Manual testing via browser console
- **Recommendation**: Move to test suite or remove from production

## Deprecated/Unused Functions

### In `groq.ts`
- `recommendImage()`: Not integrated with UI
- `generateClinicalCase()`: Not exposed in application
- `explainAnswerInline()`: Partially implemented but unused
- **Recommendation**: Either integrate or remove

### In `asyncGuard.ts`
- `createLatestOnlyRunner()`: Only used in one component
- **Recommendation**: Consider inline implementation or expand usage

## Cleanup Recommendations

1. **Remove `sm2Test.ts` from production builds**
2. **Integrate or remove unused functions in `groq.ts`**
3. **Expand usage of `asyncGuard.ts` utilities or inline them**
4. **Add proper error boundaries for AI operations**
5. **Consider moving debug utilities to separate test package**
