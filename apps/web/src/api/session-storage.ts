const sessionKey = "workflow.session";

type SecureSessionBridge = {
  get: () => string | null | Promise<string | null>;
  set: (value: string | null) => void | Promise<void>;
  remove?: () => void | Promise<void>;
};

declare global {
  interface Window {
    __WORKFLOW_SECURE_SESSION__?: SecureSessionBridge;
  }
}

let sessionTextCache: string | null | undefined;

function secureSessionBridge() {
  if (typeof window === "undefined") {
    return null;
  }
  const bridge = window.__WORKFLOW_SECURE_SESSION__;
  return bridge && typeof bridge.get === "function" && typeof bridge.set === "function" ? bridge : null;
}

function browserSessionStorage() {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function hasNativeSecureSessionStorage() {
  return Boolean(secureSessionBridge());
}

export function cacheSessionText(value: string | null) {
  sessionTextCache = value;
}

export function resetSessionTextCacheForTest() {
  sessionTextCache = undefined;
}

export function readSessionTextSync() {
  if (sessionTextCache !== undefined) {
    return sessionTextCache;
  }
  if (secureSessionBridge()) {
    sessionTextCache = null;
    return sessionTextCache;
  }
  sessionTextCache = browserSessionStorage()?.getItem(sessionKey) ?? null;
  return sessionTextCache;
}

export async function readSessionText() {
  const bridge = secureSessionBridge();
  if (bridge) {
    const value = await bridge.get();
    sessionTextCache = value || null;
    return sessionTextCache;
  }
  return readSessionTextSync();
}

export function writeSessionTextSync(value: string | null) {
  cacheSessionText(value);
  if (secureSessionBridge()) {
    return;
  }
  const storage = browserSessionStorage();
  if (!storage) return;
  if (value) {
    storage.setItem(sessionKey, value);
  } else {
    storage.removeItem(sessionKey);
  }
}

export async function writeSessionText(value: string | null) {
  cacheSessionText(value);
  const bridge = secureSessionBridge();
  if (bridge) {
    if (value) {
      await bridge.set(value);
    } else if (bridge.remove) {
      await bridge.remove();
    } else {
      await bridge.set(null);
    }
    return;
  }
  writeSessionTextSync(value);
}
