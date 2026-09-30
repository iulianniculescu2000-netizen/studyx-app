import { describe, it, expect } from 'vitest';
import { friendlyAIError } from './friendlyError';

describe('friendlyAIError', () => {
  it('explains a rate limit and keeps the wait time', () => {
    const raw = 'Eroare Groq API: Rate limit reached for model openai/gpt-oss-120b in organization org_01km8nbfv1 service tier on_demand on tokens per minute (TPM): Limit 8000, Used 7634, Requested 5676. Please try again in 8.22s. Need more tokens? Upgrade at https://console.groq.com/settings/billing';
    const out = friendlyAIError(new Error(raw));
    expect(out).toContain('limita');
    expect(out).not.toMatch(/org_|https?:/);
  });

  it('says so when the request itself is bigger than the limit', () => {
    const out = friendlyAIError('Rate limit reached: Limit 8000, Used 0, Requested 9000. Please try again in 1s');
    expect(out).toContain('prea mare');
  });

  it('handles invalid keys and network failures', () => {
    expect(friendlyAIError('401 Unauthorized')).toContain('Setări AI');
    expect(friendlyAIError(new TypeError('Failed to fetch'))).toContain('conexiunea');
  });

  it('strips provider prefixes and URLs from other errors and caps the length', () => {
    expect(friendlyAIError('Eroare Groq API: Model overloaded see https://x.io/y')).toBe('Model overloaded see');
    expect(friendlyAIError('x'.repeat(500)).length).toBeLessThanOrEqual(220);
    expect(friendlyAIError('')).toContain('Încearcă din nou');
  });
});
