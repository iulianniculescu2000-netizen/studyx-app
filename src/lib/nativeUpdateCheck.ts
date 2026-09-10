import { Capacitor } from '@capacitor/core';
import { useToastStore } from '../store/toastStore';

declare const __APP_VERSION__: string;

const REPO = 'iulianniculescu2000-netizen/studyx-app';
const CHECKED_KEY = 'studyx:android-update-checked-on';

interface GithubRelease {
  tag_name: string;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < Math.max(r.length, l.length); i += 1) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv !== lv) return rv > lv;
  }
  return false;
}

/**
 * Checks GitHub Releases for a newer Android build than the one running —
 * the Android counterpart to Electron's auto-updater (electron-updater),
 * which doesn't exist for a sideloaded APK. A sideloaded app can't
 * self-install silently either way, so this only ever surfaces a toast with
 * a direct download link; the user still taps through Android's own install
 * confirmation. No-op entirely outside the native Android shell.
 */
export async function checkForNativeUpdate(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(CHECKED_KEY) === today) return;
  } catch { /* storage blocked — just check again next launch */ }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) return;
    const release = await res.json() as GithubRelease;
    if (!isNewer(release.tag_name, __APP_VERSION__)) return;

    const apkAsset = release.assets.find((a) => a.name.endsWith('.apk'));
    const downloadUrl = apkAsset?.browser_download_url ?? release.html_url;

    useToastStore.getState().addToast(
      `O versiune nouă e disponibilă (${release.tag_name}).`,
      'info',
      10000,
      { label: 'Descarcă', onClick: () => window.open(downloadUrl, '_blank') },
    );
  } catch {
    // Offline / rate-limited GitHub API — silent, never interrupts app startup.
  } finally {
    try { localStorage.setItem(CHECKED_KEY, today); } catch { /* storage full/blocked */ }
  }
}
