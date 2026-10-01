/**
 * Which tours exist and which version of each the user has to have seen.
 * Kept free of React so the store can import it without pulling in the tour content.
 */
export type TourId = 'onboarding' | 'whatsNew' | 'residency' | 'flashcards' | 'vault';

/** The release whose content the tours currently describe. */
export const CURRENT_TOUR_VERSION = '2.3.0';

interface TourMeta {
  /** Content version; bump it to show the tour once more to everyone who saw an older one. */
  version: string;
  /**
   * True for tours worth showing again when the version changes. The onboarding is not: someone who
   * finished it in 2.2 must not be walked through the basics again, only told what is new.
   */
  repeatOnNewVersion: boolean;
}

export const TOUR_META: Record<TourId, TourMeta> = {
  onboarding: { version: CURRENT_TOUR_VERSION, repeatOnNewVersion: false },
  whatsNew: { version: CURRENT_TOUR_VERSION, repeatOnNewVersion: true },
  residency: { version: CURRENT_TOUR_VERSION, repeatOnNewVersion: true },
  flashcards: { version: CURRENT_TOUR_VERSION, repeatOnNewVersion: true },
  vault: { version: CURRENT_TOUR_VERSION, repeatOnNewVersion: true },
};

export const TOUR_IDS = Object.keys(TOUR_META) as TourId[];

/** Version recorded for profiles that finished the single tour of 2.2 and earlier. */
export const LEGACY_ONBOARDING_VERSION = '2.2.0';

/** Whether a recorded version still counts as "seen" for this tour. */
export function isTourVersionCurrent(tourId: TourId, seenVersion: string | undefined): boolean {
  if (!seenVersion) return false;
  const meta = TOUR_META[tourId];
  return meta.repeatOnNewVersion ? seenVersion === meta.version : true;
}
