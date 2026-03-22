/**
 * SM-2 Algorithm Simulation & Debug Utility
 * ==========================================
 * Replicates the exact logic from statsStore.ts calcNextReview()
 * so it can be tested independently without touching the Zustand store.
 *
 * Usage from browser console:
 *   import { runSM2Simulation, printSM2Report } from './lib/sm2Test';
 *   printSM2Report([true, true, true, false, true, true, true, true]);
 */

export interface SM2Step {
  attempt: number;
  correct: boolean;
  /** Cumulative correct answers up to this point */
  timesCorrect: number;
  /** Cumulative wrong answers up to this point */
  timesWrong: number;
  /** Ease factor after this answer */
  eFactor: number;
  /** Interval in days until next review */
  interval: number;
  /** Days since session start (approximate) */
  daysElapsed: number;
}

/**
 * Simulates the SM-2 algorithm for a sequence of correct/wrong answers.
 * Mirrors the logic in statsStore.ts calcNextReview() exactly.
 *
 * @param sequence - array of booleans: true = correct, false = wrong
 * @returns array of step results
 */
export function runSM2Simulation(sequence: boolean[]): SM2Step[] {
  let timesCorrect = 0;
  let timesWrong = 0;
  let eFactor = 2.5; // SM-2 default
  let interval = 0;
  let daysElapsed = 0;
  const steps: SM2Step[] = [];

  for (let i = 0; i < sequence.length; i++) {
    const correct = sequence[i];

    if (!correct) {
      // Wrong: reset interval to 1, reduce eFactor (min 1.3)
      const newEF = Math.max(1.3, eFactor - 0.2);
      timesWrong++;
      daysElapsed += interval > 0 ? interval : 1;
      interval = 1;
      eFactor = newEF;
    } else {
      // Correct: SM-2 interval progression
      const n = timesCorrect + 1; // n = nth correct answer
      let newInterval: number;
      if (n === 1) {
        newInterval = 1;
      } else if (n === 2) {
        newInterval = 3;
      } else {
        newInterval = Math.round(interval * eFactor);
      }
      newInterval = Math.min(newInterval, 180); // cap at 6 months
      const newEF = Math.min(2.7, eFactor + 0.1);

      timesCorrect++;
      daysElapsed += interval > 0 ? interval : 1;
      interval = newInterval;
      eFactor = newEF;
    }

    steps.push({
      attempt: i + 1,
      correct,
      timesCorrect,
      timesWrong,
      eFactor: Math.round(eFactor * 1000) / 1000,
      interval,
      daysElapsed,
    });
  }

  return steps;
}

/**
 * Validates that intervals grow roughly logarithmically (or at least monotonically)
 * for consecutive correct answers, and reset correctly after wrong answers.
 */
export interface SM2ValidationResult {
  passed: boolean;
  issues: string[];
  stats: {
    maxInterval: number;
    minEFactor: number;
    maxEFactor: number;
    correctStreak10Intervals: number[];
  };
}

export function validateSM2Logic(): SM2ValidationResult {
  const issues: string[] = [];

  // Test 1: 10 consecutive correct answers — intervals must be strictly increasing
  const correctRun = runSM2Simulation(Array(10).fill(true));
  const intervals10 = correctRun.map(s => s.interval);
  for (let i = 1; i < intervals10.length; i++) {
    if (intervals10[i] < intervals10[i - 1]) {
      issues.push(`Interval regression at step ${i + 1}: ${intervals10[i - 1]} → ${intervals10[i]} days`);
    }
  }

  // Test 2: Wrong answer must reset interval to 1
  const wrongThenRight = runSM2Simulation([true, true, true, true, false]);
  const afterWrong = wrongThenRight[4];
  if (afterWrong.interval !== 1) {
    issues.push(`Wrong answer did not reset interval to 1 (got ${afterWrong.interval})`);
  }

  // Test 3: eFactor must never drop below 1.3
  const manyWrong = runSM2Simulation(Array(20).fill(false));
  const minEF = Math.min(...manyWrong.map(s => s.eFactor));
  if (minEF < 1.3 - 0.001) {
    issues.push(`eFactor dropped below minimum 1.3 (got ${minEF})`);
  }

  // Test 4: eFactor must never exceed 2.7
  const manyCorrect = runSM2Simulation(Array(20).fill(true));
  const maxEF = Math.max(...manyCorrect.map(s => s.eFactor));
  if (maxEF > 2.7 + 0.001) {
    issues.push(`eFactor exceeded maximum 2.7 (got ${maxEF})`);
  }

  // Test 5: After wrong, eFactor must decrease
  const efBefore = correctRun[4].eFactor;
  const withWrong = runSM2Simulation([true, true, true, true, true, false]);
  const efAfter = withWrong[5].eFactor;
  if (efAfter >= efBefore) {
    issues.push(`Wrong answer did not decrease eFactor (${efBefore} → ${efAfter})`);
  }

  // Test 6: Interval cap at 180 days
  const longRun = runSM2Simulation(Array(25).fill(true));
  const cappedAt180 = longRun.every(s => s.interval <= 180);
  if (!cappedAt180) {
    issues.push('Interval exceeded 180-day cap');
  }

  return {
    passed: issues.length === 0,
    issues,
    stats: {
      maxInterval: Math.max(...longRun.map(s => s.interval)),
      minEFactor: minEF,
      maxEFactor: maxEF,
      correctStreak10Intervals: intervals10,
    },
  };
}

/**
 * Prints a human-readable SM-2 simulation report to the console.
 * Call from browser DevTools: import('./lib/sm2Test').then(m => m.printSM2Report(...))
 */
export function printSM2Report(sequence?: boolean[]): void {
  const testSeq = sequence ?? [
    // 5 correct → 1 wrong → 5 correct → 1 wrong → 8 correct
    true, true, true, true, true,
    false,
    true, true, true, true, true,
    false,
    true, true, true, true, true, true, true, true,
  ];

  const steps = runSM2Simulation(testSeq);
  console.group('📊 SM-2 Algorithm Simulation');
  console.table(steps.map(s => ({
    '#': s.attempt,
    Result: s.correct ? '✅ Corect' : '❌ Greșit',
    'Interval (zile)': s.interval,
    eFactor: s.eFactor,
    'Zile totale': s.daysElapsed,
    'Total corect': s.timesCorrect,
    'Total greșit': s.timesWrong,
  })));

  const validation = validateSM2Logic();
  console.group('🔍 Validare logică SM-2');
  if (validation.passed) {
    console.log('✅ Toate testele au trecut. Algoritmul SM-2 funcționează corect.');
  } else {
    console.error('❌ Probleme detectate:');
    validation.issues.forEach(i => console.error(' •', i));
  }
  console.log('Statistici:', validation.stats);
  console.groupEnd();
  console.groupEnd();
}
