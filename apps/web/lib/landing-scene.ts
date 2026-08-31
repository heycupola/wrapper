export const LANDING_SCENE_KEY = "wrapper:landing-scene";
export const INSTALL_SCENE_ID = "start";

export function rememberLandingScene(id: string): void {
  try {
    sessionStorage.setItem(LANDING_SCENE_KEY, id);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function peekLandingScene(): string | null {
  const fromHash = decodeURIComponent(window.location.hash.slice(1));
  if (fromHash) return fromHash;
  try {
    return sessionStorage.getItem(LANDING_SCENE_KEY);
  } catch {
    return null;
  }
}

export function clearLandingScene(id: string): void {
  try {
    if (sessionStorage.getItem(LANDING_SCENE_KEY) === id) {
      sessionStorage.removeItem(LANDING_SCENE_KEY);
    }
  } catch {
    // Ignore quota / private-mode failures.
  }
}
