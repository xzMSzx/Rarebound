export const PENDING_SESSION_KEY = 'tcg_pending_pack_session';

export function getPendingSession() {
  try {
    const data = localStorage.getItem(PENDING_SESSION_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!parsed || !parsed.id || !parsed.newCards || !Array.isArray(parsed.newCards)) {
       console.warn('[PendingPackManager] Malformed session detected. Clearing.');
       clearPendingSession();
       return null;
    }
    return parsed;
  } catch (e) {
    console.error('[PendingPackManager] Failed to parse pending session', e);
    clearPendingSession();
    return null;
  }
}

export function setPendingSession(session) {
  try {
    localStorage.setItem(PENDING_SESSION_KEY, JSON.stringify({
      ...session,
      sessionVersion: '1.7.9'
    }));
  } catch (e) {
    console.error('[PendingPackManager] Failed to save pending session', e);
  }
}

export function updatePendingSessionIndex(index) {
  const session = getPendingSession();
  if (session) {
    session.currentRevealIndex = index;
    setPendingSession(session);
  }
}

export function clearPendingSession() {
  localStorage.removeItem(PENDING_SESSION_KEY);
}