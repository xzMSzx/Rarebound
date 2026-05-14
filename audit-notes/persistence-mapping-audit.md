# Persistence Mapping Audit Report

**Date:** 14 May 2026
**Target:** Rarebound codebase (`msge-lite` primary focus)
**Objective:** Identify and document every persistent state source to prepare for cloud-save architecture.

---

## 1. Storage Keys & Ownership Map

The following `localStorage` keys were identified via static analysis of the JS source. They rely heavily on vanilla `localStorage.getItem/setItem`.

### CRITICAL RISK
These keys hold the core progression and economy state. Corruption or sync conflicts here will destroy the player experience.
* **`tcg_player_v2`** (`state/playerState.js`)
  * **Type:** Object `{ balance: number, collection: object (legacy) }`
  * **Risk:** Critical. Direct source of truth for the player's wallet. Parsing failure means wiped balance.
* **`tcg_collection_v2`** (`data/collectionManager.js`)
  * **Type:** Nested Object `{ [setId]: { [cardId]: { count, locked, reverseHolo? } } }`
  * **Risk:** Critical. Stores entire inventory. Complex nested structure risk. Extremely large payload.
* **`tcg_ags_submissions`** (`data/agsSubmissionManager.js`)
  * **Type:** Object `{ active: [], completed: [], nextSerial }`
  * **Risk:** High/Critical. Holds lock state for cards in the economy. Timestamps dictate return times. `nextSerial` is a unique ID generator that must not drift.

### HIGH RISK
These systems directly manipulate or gate access to the critical loops, or store unique seeded metadata.
* **`tcg_card_quality` / `tcg_card_quality_v2`** (`data/cardQualityManager.js`)
  * **Type:** Object mapping `setId:cardId:copyN` -> hidden seed data.
  * **Risk:** High. Tightly coupled to collection copy IDs (`copyN`). Desync between this and `tcg_collection_v2` would orphan quality data or break grading logic.
* **`tcg_recovery_state`** (`data/recoveryManager.js`)
  * **Type:** Object
  * **Risk:** High. Interacts closely with `tcg_emergency_requests`. Modifies balance as a failsafe when $ < 8.
* **`tcg_emergency_requests`** (`data/emergencyRequestManager.js`)
  * **Type:** Object mapping request IDs.
  * **Risk:** High. Tied to recovery events and market interactions.

### MEDIUM RISK
These hold time-sensitive or size-bounded data. Desyncs might cause minor exploits (e.g., getting a stipend twice) but won't break the save.
* **`tcg_economy`** (`data/economyManager.js`) - Object `{ lastRefreshTs, trendId }`. Dependent on `Date.now()`.
* **`tcg_market_values` / `tcg_market_meta`** (`data/marketValue.js`) - Object. Dynamic pricing truth.
* **`tcg_market_history`** (`data/marketHistory.js`) - Bounded history arrays per card. Size can grow, but bulk operations handle it.
* **`tcg_vendor_stocks`** (`data/vendorManager.js`) - Vendor inventories tied to refresh cycles.
* **`tcg_vendor_events`** (`data/vendorEventsManager.js`) - Timestamp-based world events.
* **`tcg_vendor_requests`** (`data/requestManager.js`) - Active vendor quest timers.
* **`tcg_stipend`** (`data/stipendManager.js`) - Tracks last claimed timestamp to prevent double-dipping.
* **`tcg_chase` / `tcg_broker_inv`** (`data/chaseManager.js`) - Date-string keyed daily/weekend rotations.
* **`tcg_value_history` / `tcg_archive_history`** - Bounded 90-day arrays. 

### LOW RISK (Settings / Vanity / Dev)
* **`tcg_settings`** (`data/settingsManager.js`) - Basic preferences.
* **`tcg_favorites`** (`data/favoritesManager.js`) - Array of cosmetic favorites.
* **`tcg_stats`** (`data/statsManager.js`), **`tcg_milestones`** (`data/milestoneManager.js`), **`tcg_reputation`**, **`tcg_favor`**, **`tcg_activity`**, **`tcg_recent_hits`**.
* **Dev Flags:** `tcg_dev_access`, `tcg_dev_diagnostics`, `tcg_dev_diag_flags`, `tcg_dev_isolation`, `tcg_infinite_balance`.

---

## 2. Persistence Helpers & Architecture

The codebase contains two specialized helpers that abstract vanilla `localStorage`:

1. **`persistenceStore.js` (`readJson` / `writeJson`)**
   - Tolerant reading. If JSON parsing fails, it quarantines the malformed payload to a backup key (`tcg_corrupt_backup:<key>:<timestamp>`).
   - Validates shapes (e.g., `isPlainObject`).
   - **Cloud Sync Note:** These backups are local-only detritus. A cloud sync tool will need to avoid syncing `tcg_corrupt_backup:*` keys.

2. **`localStorageTransaction.js` (`withLocalStorageRollback`)**
   - Best-effort rollback handler for atomic multi-key updates (e.g., fulfilling a request deducts cards, awards cash, updates reputation simultaneously).
   - Found in `requestFulfillmentManager.js`.
   - **Cloud Sync Note:** This implies strong inter-system coupling. A cloud sync approach should ideally transition to a single state atom/payload rather than relying on pseudo-transactions across 30+ separate keys.

---

## 3. Risks & Observations for Cloud Migration

### Fragmentation & Save Order Dependencies
The state is fragmented across ~30 independent `localStorage` keys. Currently, when the game boots, managers initialize independently. For cloud syncing:
* A canonical "Save Payload" must aggregate all these keys into one JSON object.
* Migration code must ensure that cross-dependent keys are hydrated together.

### Timestamp Dependence & Time Spoofing
Many systems (economy, stipends, vendor stocks, AGS grading turnaround) depend heavily on `Date.now()`.
* **Risk:** Local device time differences between Mobile and Web will cause instant vendor stock rotations or skipped stipends if a save moves across timezones or desynced clocks.
* **Fix Needs:** The cloud sync layer might need to use server-time offset tracking or delta-based durations instead of absolute timestamps.

### Duplicate Sources of Truth / Coupling
* `tcg_collection_v2` tracks `locked: boolean`. However, `tcg_ags_submissions` also tracks exactly which `copyN` of a card is actively being graded.
* `cardQualityManager` tracks `copyN` seeds, but must implicitly align with the counts inside `tcg_collection_v2`. If the sync merge strategy drops one file but keeps the other, it will corrupt a specific card copy.

### Schema Drift & Migration Logic
Some keys already show migration debt (`tcg_collection_v1` -> `v2`, `tcg_card_quality` -> `v2`).
* A cloud-save payload will need an explicit schema `version` attribute at the root so that older clients don't overwrite newer structures.

### Unique ID Integrity
`tcg_ags_submissions` generates running `nextSerial` (e.g., `AGS-001002`). If a player plays offline on two devices, resolving conflicting serials upon sync will be extremely difficult without a centralized ID generator or UUID adoption.