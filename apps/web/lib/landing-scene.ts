export const LANDING_SCENE_KEY = "wrapper:landing-scene";
export const INSTALL_SCENE_ID = "start";
export const OPEN_INSTALL_SCENE_EVENT = "wrapper:open-install-scene";
const MEMORY_TTL_MS = 2500;

let rememberedScene: string | null = null;
let rememberedUntil = 0;

export function rememberLandingScene(id: string): void {
  rememberedScene = id;
  rememberedUntil = Date.now() + MEMORY_TTL_MS;
  try {
    sessionStorage.setItem(LANDING_SCENE_KEY, id);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function peekLandingScene(): string | null {
  if (typeof window === "undefined") return rememberedScene;
  const fromHash = decodeURIComponent(window.location.hash.slice(1));
  if (fromHash) return fromHash;
  if (rememberedScene && Date.now() < rememberedUntil) return rememberedScene;
  try {
    const stored = sessionStorage.getItem(LANDING_SCENE_KEY);
    if (stored) {
      rememberedScene = stored;
      rememberedUntil = Date.now() + MEMORY_TTL_MS;
    }
    return stored;
  } catch {
    return rememberedScene && Date.now() < rememberedUntil ? rememberedScene : null;
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

export function resetLandingSceneMemory(): void {
  rememberedScene = null;
  rememberedUntil = 0;
}
