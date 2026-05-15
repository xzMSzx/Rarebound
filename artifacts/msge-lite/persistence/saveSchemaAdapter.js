import * as profileStorage from '../data/profileStorage.js';

/**
 * Canonical Save Schema v1 Adapter (Hardened)
 * * Acts as a strict compatibility bridge between the canonical JSON save payload
 * and the existing fragmented localStorage architecture.
 */

const EXPECTED_SCHEMA_VERSION = 1;

/**
 * Safely writes a value to localStorage.
 * If the value is null/undefined, it actively purges the local key 
 * to prevent legacy ghost states from bleeding through a restored save.
 * * @param {string} key 
 * @param {any} value 
 */
function safeWrite(key, value) {
    if (value === undefined || value === null) {
        profileStorage.removeItem(key); // PATcH: Prevent Ghost State desync
        return;
    }
    try {
        profileStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.error(`[SaveAdapter] Failed to write key: ${key}`, err);
    }
}

/**
 * Safely reads a value from localStorage, parsing it as JSON.
 * @param {string} key 
 * @param {any} fallback 
 * @returns {any}
 */
function safeRead(key, fallback = null) {
    try {
        const item = profileStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (err) {
        console.warn(`[SaveAdapter] Failed to read/parse key: ${key}. Returning fallback.`, err);
        return fallback;
    }
}

/**
 * Validates a canonical save payload before attempting deserialization.
 * @param {object} payload 
 * @returns {boolean}
 */
export function validateCanonicalPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        console.error('[SaveAdapter] Payload is null or not an object.');
        return false;
    }
    
    if (payload.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
        console.error(`[SaveAdapter] Unsupported schema version: ${payload.schemaVersion}. Expected ${EXPECTED_SCHEMA_VERSION}.`);
        return false;
    }

    return true;
}

/**
 * Reads a canonical save payload and strictly rehydrates the existing fragmented localStorage keys.
 * actively sanitizing omitted state to prevent ghost data bleed.
 * * @param {object} payload - The canonical Save Schema v1 payload
 * @returns {boolean} True if successful, false if validation failed
 */
export function deserializeCanonicalSave(payload) {
    if (!validateCanonicalPayload(payload)) {
        return false;
    }

    try {
        // PATCH: Prevent Transient Log Haunting. 
        // Actively clear high-frequency local state so it doesn't pollute the restored profile.
        ['tcg_activity', 'tcg_recent_hits', 'tcg_market_history'].forEach(key => {
            profileStorage.removeItem(key);
        });

        // --- PLAYER ---
        if (payload.player) {
            if (payload.player.profile) safeWrite('tcg_player_v2', payload.player.profile);
            
            if (payload.player.progression) {
                safeWrite('tcg_reputation', payload.player.progression.reputation);
                safeWrite('tcg_milestones', payload.player.progression.milestones);
                safeWrite('tcg_prestige_bonus', payload.player.progression.prestigeBonus);
                safeWrite('tcg_stats', payload.player.progression.stats);
            }

            if (payload.player.settings) {
                safeWrite('tcg_settings', payload.player.settings.core);
                safeWrite('tcg_dev_access', payload.player.settings.devAccess);
                safeWrite('tcg_infinite_balance', payload.player.settings.infiniteBalance);
            }
        }

        // --- COLLECTION ---
        if (payload.collection) {
            safeWrite('tcg_collection_v2', payload.collection.inventory);
            safeWrite('tcg_card_quality_v2', payload.collection.quality);
            safeWrite('tcg_favorites', payload.collection.favorites);
            safeWrite('tcg_wishlist', payload.collection.wishlist);
        }

        // --- AGS ---
        if (payload.ags) {
            safeWrite('tcg_ags_submissions', payload.ags.submissions);
        }

        // --- ECONOMY ---
        if (payload.economy) {
            if (payload.economy.market) {
                safeWrite('tcg_market_values', payload.economy.market.values);
                safeWrite('tcg_market_meta', payload.economy.market.meta);
            }
            if (payload.economy.playerEconomy) {
                safeWrite('tcg_economy', payload.economy.playerEconomy.core);
                safeWrite('tcg_favor', payload.economy.playerEconomy.favor);
                safeWrite('tcg_stipend', payload.economy.playerEconomy.stipend);
            }
            if (payload.economy.vendors) {
                safeWrite('tcg_vendor_stocks', payload.economy.vendors.stocks);
                safeWrite('tcg_vendor_events', payload.economy.vendors.events);
                safeWrite('tcg_broker_inv', payload.economy.vendors.broker);
                safeWrite('tcg_chase', payload.economy.vendors.chase);
            }
        }

        // --- ACTIVITIES ---
        if (payload.activities) {
            if (payload.activities.requests) {
                safeWrite('tcg_vendor_requests', payload.activities.requests.vendor);
                safeWrite('tcg_emergency_requests', payload.activities.requests.emergency);
            }
            safeWrite('tcg_box_offerings', payload.activities.mysteryBoxes);
            safeWrite('tcg_recovery_state', payload.activities.recovery);
            safeWrite('tcg_distress_state', payload.activities.distress); // PATCH: Added missing mapping
        }

        // --- HISTORY ---
        if (payload.history) {
            safeWrite('tcg_archive_history', payload.history.archiveHistory);
            safeWrite('tcg_value_history', payload.history.valueHistory);
        }

        console.log('[SaveAdapter] Successfully and strictly deserialized canonical payload into localStorage.');
        return true;
    } catch (err) {
        console.error('[SaveAdapter] Catastrophic failure during deserialization:', err);
        return false;
    }
}

/**
 * Builds a canonical save payload from the current fragmented localStorage state.
 * @returns {object} The canonical Save Schema v1 payload
 */
export function serializeToCanonicalSave() {
    return {
        schemaVersion: EXPECTED_SCHEMA_VERSION,
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            platform: "web"
        },
        player: {
            profile: safeRead('tcg_player_v2', {}),
            progression: {
                reputation: safeRead('tcg_reputation', {}),
                milestones: safeRead('tcg_milestones', []),
                prestigeBonus: safeRead('tcg_prestige_bonus', 0),
                stats: safeRead('tcg_stats', {})
            },
            settings: {
                core: safeRead('tcg_settings', {}),
                devAccess: safeRead('tcg_dev_access', false),
                infiniteBalance: safeRead('tcg_infinite_balance', false)
            }
        },
        collection: {
            inventory: safeRead('tcg_collection_v2', {}),
            quality: safeRead('tcg_card_quality_v2', {}),
            favorites: safeRead('tcg_favorites', []),
            wishlist: safeRead('tcg_wishlist', [])
        },
        ags: {
            submissions: safeRead('tcg_ags_submissions', {})
        },
        economy: {
            market: {
                values: safeRead('tcg_market_values', {}),
                meta: safeRead('tcg_market_meta', {})
            },
            playerEconomy: {
                core: safeRead('tcg_economy', {}),
                favor: safeRead('tcg_favor', {}),
                stipend: safeRead('tcg_stipend', {})
            },
            vendors: {
                stocks: safeRead('tcg_vendor_stocks', {}),
                events: safeRead('tcg_vendor_events', {}),
                broker: safeRead('tcg_broker_inv', {}),
                chase: safeRead('tcg_chase', {})
            }
        },
        activities: {
            requests: {
                vendor: safeRead('tcg_vendor_requests', {}),
                emergency: safeRead('tcg_emergency_requests', {})
            },
            mysteryBoxes: safeRead('tcg_box_offerings', {}),
            recovery: safeRead('tcg_recovery_state', null),
            distress: safeRead('tcg_distress_state', null) // PATCH: Added missing mapping
        },
        history: {
            archiveHistory: safeRead('tcg_archive_history', []),
            valueHistory: safeRead('tcg_value_history', [])
        }
    };
}