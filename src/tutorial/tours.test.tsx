import { beforeEach, describe, expect, it } from 'vitest';
import { migrateTutorialState, useTutorialStore } from '../store/tutorialStore';
import { LEGACY_ONBOARDING_VERSION, TOUR_IDS, TOUR_META } from './tourMeta';
import { TOURS, type SpotlightTourId } from './registry';
import { keyGuideIntro } from './keyGuideText';
import { savedProviders } from './useTourContext';
import type { TourContext } from './types';

const emptyContext: TourContext = { aiProviders: [], aiKeyCount: 0, quizCount: 0, deckCount: 0, sourceCount: 0, pathname: '/' };
const spotlightIds = Object.keys(TOURS) as SpotlightTourId[];

describe('tour registry', () => {
  it('gives every spotlight tour at least two steps and unique step ids', () => {
    for (const id of spotlightIds) {
      const steps = TOURS[id].steps;
      expect(steps.length, id).toBeGreaterThanOrEqual(2);
      expect(new Set(steps.map((step) => step.id)).size, id).toBe(steps.length);
    }
  });

  it('keeps tour ids in step with the metadata', () => {
    for (const id of spotlightIds) expect(TOURS[id].id).toBe(id);
    expect(TOUR_IDS).toContain('whatsNew');
  });

  it('survives every adaptive hook on an empty profile', () => {
    for (const id of spotlightIds) {
      for (const step of TOURS[id].steps) {
        expect(() => step.when?.(emptyContext)).not.toThrow();
        expect(() => step.completeWhen?.(emptyContext, emptyContext)).not.toThrow();
        const body = typeof step.body === 'function' ? step.body(emptyContext) : step.body;
        expect(body.length, step.id).toBeGreaterThan(10);
      }
    }
  });

  it('never quotes a provider limit in a tour text, since those change', () => {
    for (const id of spotlightIds) {
      for (const step of TOURS[id].steps) {
        const body = typeof step.body === 'function' ? step.body(emptyContext) : step.body;
        expect(`${step.title} ${body}`, step.id).not.toMatch(/tokeni|miliard|1\.000\.000/i);
      }
    }
  });

  it('asks the user to create a grilă and finishes when the count goes up', () => {
    const step = TOURS.onboarding.steps.find((entry) => entry.id === 'first-quiz');
    expect(step?.completeWhen?.(emptyContext, emptyContext)).toBe(false);
    expect(step?.completeWhen?.({ ...emptyContext, quizCount: 1 }, emptyContext)).toBe(true);
  });
});

describe('AI key guide text', () => {
  it('speaks differently for zero, one and several keys', () => {
    const none = keyGuideIntro(0, []);
    const one = keyGuideIntro(1, ['groq']);
    const many = keyGuideIntro(2, ['groq', 'google']);
    expect(new Set([none, one, many]).size).toBe(3);
    expect(one).toContain('Groq');
    expect(many).toContain('Google Gemini');
  });

  it('counts the active provider key and ignores blanks', () => {
    expect(savedProviders({ groq: 'gsk_x', google: '  ' }, 'groq', 'gsk_x')).toEqual(['groq']);
    expect(savedProviders({}, 'mistral', 'abc').sort()).toEqual(['mistral']);
    expect(savedProviders({ groq: 'a', google: 'b' }, 'groq', 'a').sort()).toEqual(['google', 'groq']);
  });
});

describe('tutorial store', () => {
  beforeEach(() => {
    useTutorialStore.setState({ activeTour: null, active: false, currentStep: 0, seen: {} });
  });

  it('carries the old completed profiles over without re-running the onboarding', () => {
    const migrated = migrateTutorialState({ completedProfiles: ['p1'], active: true, currentStep: 7 });
    expect(migrated.seen.p1?.onboarding).toBe(LEGACY_ONBOARDING_VERSION);
    useTutorialStore.setState({ seen: migrated.seen });
    expect(useTutorialStore.getState().isCompleted('p1')).toBe(true);
    expect(useTutorialStore.getState().isCompleted('p2')).toBe(false);
  });

  it('still shows what is new, and the page tours, to a profile migrated from 2.2', () => {
    useTutorialStore.setState({ seen: migrateTutorialState({ completedProfiles: ['p1'] }).seen });
    const { hasSeen } = useTutorialStore.getState();
    expect(hasSeen('p1', 'whatsNew')).toBe(false);
    expect(hasSeen('p1', 'residency')).toBe(false);
  });

  it('records a tour as seen when it is closed, and shows it again for a newer version', () => {
    const store = useTutorialStore.getState();
    store.startTour('residency');
    store.finishTour('p1');
    expect(useTutorialStore.getState().active).toBe(false);
    expect(useTutorialStore.getState().hasSeen('p1', 'residency')).toBe(true);

    useTutorialStore.setState({ seen: { p1: { residency: '2.2.0' } } });
    expect(useTutorialStore.getState().hasSeen('p1', 'residency')).toBe(false);
  });

  it('marks every tour seen once the onboarding ends, so a new user skips "what is new"', () => {
    const store = useTutorialStore.getState();
    store.startTutorial();
    store.finishTour('p1');
    for (const id of TOUR_IDS) expect(useTutorialStore.getState().hasSeen('p1', id), id).toBe(true);
    expect(useTutorialStore.getState().seen.p1?.whatsNew).toBe(TOUR_META.whatsNew.version);
  });

  it('keeps a profile that has not finished separate from one that has', () => {
    useTutorialStore.getState().markSeen('p1', 'onboarding');
    expect(useTutorialStore.getState().isCompleted('p2')).toBe(false);
  });

  it('closes after the last step and only moves forward within the tour length', () => {
    const store = useTutorialStore.getState();
    store.startTour('flashcards');
    store.nextStep(3);
    expect(useTutorialStore.getState().currentStep).toBe(1);
    store.nextStep(3);
    store.nextStep(3);
    expect(useTutorialStore.getState().active).toBe(false);
    expect(useTutorialStore.getState().currentStep).toBe(0);
  });
});
