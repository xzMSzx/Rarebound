# Rarebound Canonical Save Schema v1

## 1. Architecture Proposal
The goal of the Canonical Save Schema is to unify the current ~30 fragmented `localStorage` keys into a single, cohesive JSON payload. This payload will act as the source of truth for cloud syncing (Supabase), manual backup/restore, and schema migrations. 

The architecture moves away from multi-step, partial-commit mutations by introducing a unified state tree. It solves existing persistence desyncs by ensuring cross-system state (e.g., AGS submissions locking collection copies, and balance debits) are grouped under single transactional boundaries.

## 2. Payload Hierarchy (Schema v1)

```json
{
  "schemaVersion": 1,
  "metadata": {
    "createdAt": "2023-10-01T12:00:00.000Z",
    "updatedAt": "2023-10-01T12:00:00.000Z",
    "platform": "web"
  },
  "player": {
    "profile": {
      "name": "string",
      "xp": 0,
      "balance": 0.00
    },
    "progression": {
      "reputation": { /* from tcg_reputation */ },
      "milestones": [ /* from tcg_milestones */ ],
      "prestigeBonus": 0, /* from tcg_prestige_bonus */
      "stats": { /* from tcg_stats */ }
    },
    "settings": {
      /* tcg_settings, tcg_dev_access, tcg_infinite_balance */
    }
  },
  "collection": {
    "inventory": { 
      /* Migrated from tcg_collection_v2. 
         Transition from aggregate {count: N} to distinct copy records is recommended. */ 
    },
    "quality": { /* from tcg_card_quality_v2 */ },
    "favorites": [ /* from tcg_favorites */ ],
    "wishlist": [ /* from tcg_wishlist */ ]
  },
  "ags": {
    "submissions": { /* from tcg_ags_submissions */ }
  },
  "economy": {
    "market": { 
      /* tcg_market_values, tcg_market_meta */
      /* tcg_market_history is truncated/omitted */
    },
    "playerEconomy": {
      /* tcg_economy, tcg_favor, tcg_stipend */
    },
    "vendors": {
      /* tcg_vendor_stocks, tcg_vendor_events, tcg_broker_inv, tcg_chase */
    }
  },
  "activities": {
    "requests": { /* tcg_vendor_requests, tcg_emergency_requests */ },
    "mysteryBoxes": { /* tcg_box_offerings */ },
    "recovery": { /* tcg_recovery_state */ }
  },
  "history": {
    /* Only critical, low-volume history is synced */
    "archiveHistory": [ /* from tcg_archive_history */ ],
    "valueHistory": [ /* from tcg_value_history */ ]
  }
}
```

## 3. Structural Recommendations

### Groupings & Mergers
- **Identity & Settings:** Player profile, settings, reputation, stats, and milestones form the `player` block. These are high-value and must never be lost.
- **Collection State:** `inventory`, `quality`, `favorites`, and `wishlist` are grouped. Long-term, `inventory` and `quality` should merge into an instance-based array to fix the "count-only vs AGS lock" vulnerability.
- **AGS:** Kept as a top-level domain because of its strict schema requirements (active vs completed, serial increments).
- **Economy:** Groups both global states (market values, vendor stocks, world events) and player-specific states (favor, stipend) into a single branch.

### Isolation & Transient State
- **Omit / Do Not Cloud Sync:** `tcg_activity` and `tcg_recent_hits` should remain local or be heavily truncated. Syncing high-frequency, purely cosmetic logs wastes bandwidth and increases conflict risk. `tcg_market_history` can also be omitted or truncated, as only the current values matter for gameplay state.

## 4. Migration & Versioning Strategy

- **Timestamp Normalization:** All `Date.now()` timestamps must be normalized to UTC ISO-8601 strings during the payload build. This prevents timezone drift across multiple devices.
- **UUID Migration:** Currently, cards use aggregate counts + `copyN` indexing. The migration script for `schemaVersion: 2` must transition `tcg_collection_v2` and `tcg_card_quality_v2` into a single `instances: [{ instanceId: UUID, cardId, quality, lockedBy }]` structure to guarantee AGS serial integrity and safe consumption paths.
- **Transactional Integrity:** A persistence manager must be introduced that accepts a serialized `save()` payload. If any mutation fails locally, the state rolls back to the previous tree, preventing partial commits where (for example) money is spent but a card is not granted.

## 5. Risk Analysis & Adapters

- **High-Risk Area (AGS & Collection):** The current vulnerability where AGS locks aren't enforced by `sellingManager` and `requestManager` must be patched via a compat adapter *before* enabling cloud sync, otherwise conflicting states will be immortalized in the cloud.
- **Compatibility Adapters:** Until the codebase is refactored to read from the unified schema tree in-memory, a boot-time adapter must deserialize the canonical payload back into the ~30 fragmented `localStorage` keys, and a save adapter must re-assemble them on `setInterval` or critical events.
- **Save Collision (Multi-device):** A simple `updatedAt` comparison will be needed when pulling from Supabase. If the local timestamp is newer than cloud, prompt the user; otherwise, overwrite local.
