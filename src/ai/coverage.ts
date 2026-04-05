import type { CoverageRecord } from './types';

const COVERAGE_KEY = 'studyx-ai-coverage';

export function loadCoverage(): CoverageRecord[] {
  try {
    const raw = localStorage.getItem(COVERAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function updateCoverage(topic: string, increment = 0.1) {
  const all = loadCoverage();
  const existing = all.find((entry) => entry.topic === topic);
  if (existing) {
    existing.coverageScore = Math.min(1, existing.coverageScore + increment);
    existing.lastUpdated = Date.now();
  } else {
    all.push({ topic, coverageScore: Math.min(1, increment), lastUpdated: Date.now() });
  }
  try {
    localStorage.setItem(COVERAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('[Coverage] Failed to save coverage:', err);
  }
}
