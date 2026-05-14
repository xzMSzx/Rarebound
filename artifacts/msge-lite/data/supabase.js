import { createClient } from '@supabase/supabase-js';

import {
  serializeToCanonicalSave,
  deserializeCanonicalSave
} from '../persistence/saveSchemaAdapter.js';

import { totalArchiveValue } from './agsMarketIntegration.js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase] Missing environment variables. Running in local-only / guest mode.'
  );
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * Uploads the current canonical save to the user_saves table.
 */
export async function uploadCloudSave() {
  if (!supabase) {
    return { error: { message: 'Cloud archive unavailable.' } };
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('Authentication required to upload.');
    }

    const payload = serializeToCanonicalSave();

    // =========================
    // Collection Metadata Build
    // =========================

    // Compute directly from the canonical payload to ensure consistency
    const inventory = payload.collection?.inventory || payload.player?.profile?.collection || {};
    const marketValues = payload.economy?.market?.values || {};

    let totalCards = 0;
    let rawValue = 0;

    if (Array.isArray(inventory)) {
      inventory.forEach(card => {
        const count = card.count || 1;
        totalCards += count;
        rawValue += (marketValues[card.id] || 0) * count;
      });
    } else {
      Object.values(inventory).forEach(setObj => {
        if (typeof setObj === 'object' && setObj !== null) {
          Object.entries(setObj).forEach(([cardId, cardData]) => {
            const count = cardData.count || 1;
            totalCards += count;
            rawValue += (marketValues[cardId] || 0) * count;
          });
        }
      });
    }

    // AGS archived slabs
    const slabs = payload.ags?.submissions?.completed || [];
    totalCards += slabs.length;

    const slabValue = totalArchiveValue(
      slabs,
      (id, rarity) => marketValues[id] || 0
    );

    const collectionValue = rawValue + slabValue;

    // =========================
    // Metadata Snapshot
    // =========================

    const metadata = {
      collectionValue,
      totalCards,
      platform: 'web',
      updatedAt: new Date().toISOString()
    };

    // Future conflict resolution hook could go here
    // Example:
    // compare updated_at timestamps before overwrite

    const { error } = await supabase
      .from('user_saves')
      .upsert(
        {
          user_id: session.user.id,
          schema_version: payload.schemaVersion,
          save_payload: payload,
          metadata,
          updated_at: metadata.updatedAt
        },
        {
          onConflict: 'user_id'
        }
      );

    if (error) {
      throw error;
    }

    return { success: true };

  } catch (err) {
    console.error('[Supabase] Upload failed:', err);

    return {
      error: {
        message: err.message || 'Failed to upload save.'
      }
    };
  }
}

/**
 * Restores the canonical save from the user_saves table.
 */
export async function restoreCloudSave() {
  if (!supabase) {
    return { error: { message: 'Cloud archive unavailable.' } };
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('Authentication required to restore.');
    }

    const { data, error } = await supabase
      .from('user_saves')
      .select('save_payload, updated_at')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('No cloud save found for this account.');
      }

      throw error;
    }

    if (!data || !data.save_payload) {
      throw new Error('Cloud save is empty or corrupted.');
    }

    const payload = data.save_payload;

    const success = deserializeCanonicalSave(payload);

    if (!success) {
      throw new Error(
        'Failed to validate or deserialize cloud save payload.'
      );
    }

    return { success: true };

  } catch (err) {
    console.error('[Supabase] Restore failed:', err);

    return {
      error: {
        message: err.message || 'Failed to restore save.'
      }
    };
  }
}

/**
 * Fetches only metadata to determine
 * whether a cloud save exists.
 */
export async function getCloudSaveMetadata() {
  if (!supabase) {
    return { error: { message: 'Cloud archive unavailable.' } };
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return {
        error: { message: 'Not authenticated' }
      };
    }

    const { data, error } = await supabase
      .from('user_saves')
      .select('metadata, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return { data };

  } catch (err) {
    console.error('[Supabase] Metadata fetch failed:', err);

    return {
      error: {
        message: err.message || 'Failed to fetch metadata.'
      }
    };
  }
}