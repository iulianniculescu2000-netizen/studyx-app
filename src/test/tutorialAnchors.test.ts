import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('tutorial spotlight targets', () => {
  const tutorial = readFileSync('src/components/Tutorial.tsx', 'utf8');
  const targets = [...tutorial.matchAll(/target: '\[data-tutorial="([^"]+)"\]'/g)].map((match) => match[1]);

  const anchored = new Set<string>();
  for (const file of sourceFiles('src').filter((path) => !path.endsWith('Tutorial.tsx'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/data-tutorial="([^"]+)"/g)) anchored.add(match[1]);
  }

  it('finds the targets it checks', () => {
    expect(targets.length).toBeGreaterThan(5);
  });

  it('has an element carrying every data-tutorial a step points at', () => {
    const missing = [...new Set(targets)].filter((target) => !anchored.has(target));
    expect(missing).toEqual([]);
  });
});
