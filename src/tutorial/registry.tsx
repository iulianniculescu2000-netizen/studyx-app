import { flashcardsTour } from './tours/flashcards';
import { onboardingTour } from './tours/onboarding';
import { residencyTour } from './tours/residency';
import { vaultTour } from './tours/vault';
import type { TourId } from './tourMeta';
import type { TourDefinition } from './types';

/** The tours that run as a spotlight, one step at a time. "What's new" is a slide show with its own component. */
export type SpotlightTourId = Exclude<TourId, 'whatsNew'>;

export const TOURS: Record<SpotlightTourId, TourDefinition> = {
  onboarding: onboardingTour,
  residency: residencyTour,
  flashcards: flashcardsTour,
  vault: vaultTour,
};

export const isSpotlightTour = (id: TourId): id is SpotlightTourId => id in TOURS;
