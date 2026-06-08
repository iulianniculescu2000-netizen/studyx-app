const STARTUP_KEY = 'studyx-startup-session';
const STALE_STARTUP_MS = 1000 * 60 * 3;

type StartupSessionState = {
  active: boolean;
  startedAt: number;
  completedAt?: number;
};

function readState(): StartupSessionState | null {
  try {
    const raw = localStorage.getItem(STARTUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StartupSessionState;
  } catch {
    return null;
  }
}

function writeState(state: StartupSessionState) {
  try {
    localStorage.setItem(STARTUP_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal.
  }
}

export function inspectPreviousStartup() {
  const previous = readState();
  if (!previous?.active) return { hadUncleanExit: false };

  const age = Date.now() - previous.startedAt;
  return {
    hadUncleanExit: age > 0,
    stale: age > STALE_STARTUP_MS,
    previous,
  };
}

export function beginStartupSession() {
  writeState({
    active: true,
    startedAt: Date.now(),
  });
}

export function completeStartupSession() {
  writeState({
    active: false,
    startedAt: readState()?.startedAt ?? Date.now(),
    completedAt: Date.now(),
  });
}
