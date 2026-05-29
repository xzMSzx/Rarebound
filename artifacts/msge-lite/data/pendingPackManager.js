export const PENDING_SESSION_KEY = 'tcg_pending_pack_session';

export function getPendingSession() {
  try {
    const data = localStorage.getItem(PENDING_SESSION_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    
    // v2.0.0 - multi-pack architecture validation
    if (!parsed || !parsed.id || !parsed.packs || !Array.isArray(parsed.packs) || parsed.packs.length === 0) {
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
      sessionVersion: '2.0.0'
    }));
  } catch (e) {
    console.error('[PendingPackManager] Failed to save pending session', e);
  }
}

export function updatePendingSessionIndex(packIndex, revealIndex) {
  const session = getPendingSession();
  if (session) {
    if (packIndex !== undefined) session.currentPackIndex = packIndex;
    if (revealIndex !== undefined) session.currentRevealIndex = revealIndex;
    setPendingSession(session);
  }
}

export function clearPendingSession() {
  localStorage.removeItem(PENDING_SESSION_KEY);
}