/**
 * data/profileStorage.js
 *
 * Profile-isolated persistence namespace wrapper.
 * Intercepts storage calls and namespaces them by the active profile ID.
 * Falls back to legacy non-namespaced keys for backward compatibility.
 */

// Synchronous boot hint: allows profileStorage to know the active profile
// immediately during script parsing, before main.js hydrates managers.
let activeProfileId = localStorage.getItem('rb_active_profile_id') || 'guest';

/**
 * Gets the current active profile ID.
 * @returns {string}
 */
export function getActiveProfileId() {
  return activeProfileId;
}

/**
 * Sets the active profile ID.
 * @param {string} id 
 */
export function setActiveProfileId(id) {
  if (id) {
    activeProfileId = id;
    localStorage.setItem('rb_active_profile_id', id);
    console.log(`[ProfileStorage] Active profile set to: ${id}`);
  }
}

/**
 * Determines if a key should be ignored by the namespace system.
 * Global settings, debug flags, and structural system keys should remain un-namespaced.
 */
function isGlobalKey(key) {
  const globalKeys = [
    'tcg_dev_diagnostics',
    'tcg_dev_isolation'
  ];
  return globalKeys.includes(key);
}

/**
 * Gets the profile-scoped version of a key.
 */
function getScopedKey(key) {
  if (isGlobalKey(key)) return key;
  return `rb_profile_${activeProfileId}_${key}`;
}

/**
 * Gets an item from storage.
 * Falls back to legacy non-namespaced key if the scoped key doesn't exist.
 */
export function getItem(key) {
  if (isGlobalKey(key)) {
    return localStorage.getItem(key);
  }

  const scopedKey = getScopedKey(key);
  let value = localStorage.getItem(scopedKey);

  // Backward compatibility fallback
  if (value === null) {
    value = localStorage.getItem(key);
    // Note: We do NOT write this back to the scoped key here.
    // Migration happens organically upon the next save.
  }

  return value;
}

/**
 * Sets an item in storage under the profile-scoped key.
 */
export function setItem(key, value) {
  if (isGlobalKey(key)) {
    localStorage.setItem(key, value);
    return;
  }

  const scopedKey = getScopedKey(key);
  localStorage.setItem(scopedKey, value);
}

/**
 * Removes an item from storage for the active profile.
 * Does NOT remove the legacy key to ensure non-destructive behavior during migration.
 */
export function removeItem(key) {
  if (isGlobalKey(key)) {
    localStorage.removeItem(key);
    return;
  }

  const scopedKey = getScopedKey(key);
  localStorage.removeItem(scopedKey);
}

/**
 * Clears all data associated with the active profile.
 */
export function clearProfile() {
  const prefix = `rb_profile_${activeProfileId}_`;
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      keysToRemove.push(k);
    }
  }
  
  keysToRemove.forEach(k => localStorage.removeItem(k));
  console.log(`[ProfileStorage] Cleared data for profile: ${activeProfileId}`);
}
