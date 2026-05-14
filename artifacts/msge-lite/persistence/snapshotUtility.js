/**
 * persistence/snapshotUtility.js
 *
 * Manual Snapshot Utility
 * -----------------------------------------
 * Local export/import tooling for Canonical
 * Save Schema v1.
 *
 * Used for:
 * - save roundtrip testing
 * - local backups
 * - migration verification
 * - future cloud sync bridge testing
 */

import {
  serializeToCanonicalSave,
  deserializeCanonicalSave,
} from './saveSchemaAdapter.js';

/**
 * Export current game state as downloadable JSON snapshot.
 */
export function exportSnapshot() {
  try {
    console.log('[SnapshotUtility] Generating canonical snapshot...');

    const payload = serializeToCanonicalSave();

    const json = JSON.stringify(payload, null, 2);

    const blob = new Blob(
      [json],
      { type: 'application/json' }
    );

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const filename = `rarebound-save-v1-${timestamp}.json`;

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);

    console.log(
      `[SnapshotUtility] Export successful: ${filename}`
    );

  } catch (err) {
    console.error(
      '[SnapshotUtility] Export failed:',
      err
    );

    alert(
      'Failed to export snapshot. Check console for details.'
    );
  }
}

/**
 * Import canonical snapshot JSON and restore local state.
 */
export function importSnapshot() {
  const input = document.createElement('input');

  input.type = 'file';
  input.accept = '.json,application/json';

  input.onchange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const raw = e.target?.result;

        if (typeof raw !== 'string') {
          throw new Error('Invalid file payload.');
        }

        const payload = JSON.parse(raw);

        const confirmed = window.confirm(
          [
            'WARNING: RESTORE SNAPSHOT',
            '',
            'This will completely overwrite',
            'your current local save data.',
            '',
            'This action cannot be undone.',
            '',
            'Continue?',
          ].join('\n')
        );

        if (!confirmed) {
          console.log(
            '[SnapshotUtility] Restore cancelled.'
          );
          return;
        }

        console.log(
          '[SnapshotUtility] Restoring canonical snapshot...'
        );

        const success =
          deserializeCanonicalSave(payload);

        if (!success) {
          alert(
            'Restore failed.\n\nInvalid or corrupted snapshot.'
          );

          return;
        }

        console.log(
          '[SnapshotUtility] Restore successful.'
        );

        alert(
          'Snapshot restored successfully.\n\nThe game will now reload.'
        );

        window.location.reload();

      } catch (err) {
        console.error(
          '[SnapshotUtility] Import failed:',
          err
        );

        alert(
          'Import failed.\n\nThe selected file is invalid.'
        );
      }
    };

    reader.onerror = (err) => {
      console.error(
        '[SnapshotUtility] File read failed:',
        err
      );

      alert(
        'Could not read selected snapshot file.'
      );
    };

    reader.readAsText(file);
  };

  input.click();
}