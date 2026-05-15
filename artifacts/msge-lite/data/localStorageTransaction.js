import * as profileStorage from './profileStorage.js';

/**
 * data/localStorageTransaction.js
 *
 * Best-effort rollback for small localStorage operations. This is not a true
 * database transaction, but it prevents partial commits across known keys.
 */

export function withLocalStorageRollback(keys, operation) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  const snapshot = uniqueKeys.map(key => ({
    key,
    value: profileStorage.getItem(key),
  }));

  try {
    return operation();
  } catch (err) {
    let rollbackError = null;
    for (const { key, value } of snapshot) {
      try {
        if (value === null) profileStorage.removeItem(key);
        else profileStorage.setItem(key, value);
      } catch (restoreErr) {
        rollbackError = rollbackError || restoreErr;
      }
    }
    if (rollbackError) console.error('[storage-transaction] rollback restore failed', rollbackError);
    throw err;
  }
}
