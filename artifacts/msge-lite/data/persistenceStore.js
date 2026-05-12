/**
 * data/persistenceStore.js
 *
 * Tiny localStorage helper for critical save data. It keeps reads tolerant,
 * but quarantines malformed payloads instead of silently discarding them.
 */

const BACKUP_PREFIX = 'tcg_corrupt_backup';

function backupCorruptPayload(key, raw) {
  if (raw === null || raw === undefined) return;
  try {
    const backupKey = `${BACKUP_PREFIX}:${key}:${Date.now()}`;
    localStorage.setItem(backupKey, raw);
  } catch {
    // Best-effort only; never make recovery reads fail because backup failed.
  }
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

export function readJson(key, fallback, validate = () => true) {
  const raw = localStorage.getItem(key);
  if (raw === null) return { ok: true, value: fallback, recovered: false };

  try {
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) {
      backupCorruptPayload(key, raw);
      return { ok: false, value: fallback, recovered: true };
    }
    return { ok: true, value: parsed, recovered: false };
  } catch {
    backupCorruptPayload(key, raw);
    return { ok: false, value: fallback, recovered: true };
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return { ok: true };
}
