# Timestamp Normalization Audit and Migration Plan (Schema v1)

## 1. Executive Summary
This document outlines the timestamp sources, usage, risks, and normalization strategy across the Rarebound codebase to prepare for the v1 Save Schema migration and future cloud synchronization.

**Core Recommendation**:
* **Runtime:** Continue using UTC millisecond integers (`Date.now()`) internally across the codebase for all arithmetic, expiration, and cooldown calculations.
* **Persistence:** Canonical Save Schema payloads must normalize persisted/exported timestamps into UTC-safe ISO-8601 strings *only at the adapter layer* during serialization, and convert them back to milliseconds during deserialization.
* **Goal:** Prevent timezone drift, eliminate ghost timer states, and prepare for multi-device restore compatibility without rewriting runtime logic.

---

## 2. System Audits

### 2.1 Vendor Systems
* **File References:** `data/vendorManager.js`, `data/vendorEventsManager.js`, `data/chaseManager.js`, `main.js` (temporary vendor discounts)
* **Persistence Keys:** `tcg_vendor_events`, `tcg_chase`
* **Timestamp Sources:**
  * `Date.now()` (for `eventEndsAt`, `chase.expiry`, discounts)
  * `new Date().getDay()` (for Broker availability and `getBrokerNextOpenLabel`)
* **Risks:**
  * **Timezone Drift:** The use of `new Date().getDay()` inherently depends on local system time. A player in Tokyo will see the Broker open at a different absolute time than a player in New York. While cloud syncing `getDay()` results isn't applicable (it's evaluated dynamically), this is a significant spoofing vector and local time dependency.
  * **Negative Timer Edge Cases:** `Math.max(0, ...)` is generally well-handled, but restoring an older save with an expired chase/event will immediately trigger clearance, which is correct behavior.
  * **Stale Restore Risks:** If a save is restored from days ago, `chase.expiry` and `eventEndsAt` will be cleanly invalidated because of UTC timestamp expiration comparisons, but the player loses the events they "earned" on the active device.

### 2.2 Economy & Market Systems
* **File References:** `data/economyManager.js`, `data/marketValue.js`, `data/marketHistory.js`, `data/stipendManager.js`, `data/prestigeManager.js`
* **Persistence Keys:** `tcg_economy` (`lastRefreshTs`), `tcg_market_meta` (`lastDrift`), `tcg_market_history` (`t`), `tcg_stipend` (`lastClaimedTs`)
* **Timestamp Sources:**
  * `Date.now()` (arithmetic against `lastRefreshTs`, `lastDrift`, `lastClaimedTs`)
  * `Math.floor(Date.now() / 86_400_000)` (daily stipend seed key)
* **Risks:**
  * **Clock Spoofing:** Changing the local clock forward will instantly refresh the economy (`lastRefreshTs`), trigger market drifts (`lastDrift`), and allow stipend claims (`lastClaimedTs`).
  * **Negative Timers:** Restoring an older state over a newer state (e.g., cloud sync overriding local state) will revert `lastClaimedTs` to the past, re-enabling stipend claims, causing an economy exploit.

### 2.3 Activity & Requests
* **File References:** `data/requestManager.js`, `data/emergencyRequestManager.js`
* **Persistence Keys:** `tcg_vendor_requests`, `tcg_emergency_requests`
* **Timestamp Sources:**
  * `Date.now()` (for `createdAt` metadata, ID generation seeds, and `lastRefresh`/`refreshedAt` calculations)
* **Risks:**
  * **Clock Spoofing:** Changing the clock forward forces new request rotations.

### 2.4 AGS Submissions
* **File References:** `data/agsSubmissionManager.js`
* **Persistence Keys:** `tcg_ags_submissions`
* **Timestamp Sources:**
  * `Date.now()` (for `submittedAt`, `returnAt`, `gradedAt`)
* **Risks:**
  * **Clock Spoofing:** Setting the clock forward instantly grades all active submissions.
  * **Stale Restore Risks:** Restoring an old save over a newer one will re-trigger the grading of cards that had already been synced as graded, potentially duplicating grades or causing desyncs with locked inventory state.

### 2.5 Recovery System
* **File References:** `data/recoveryManager.js`
* **Persistence Keys:** `tcg_recovery_state`
* **Timestamp Sources:**
  * `Date.now()` (`focusRotatedAt`, `lastReliefTs`)
* **Risks:**
  * **Clock Spoofing:** Forwarding the clock rotates focus or clears relief cooldowns instantaneously.

### 2.6 History & Cosmetics
* **File References:** `data/archiveHistoryManager.js`, `data/collectionValueHistory.js`, `data/activityFeed.js`, `data/recentHits.js`, `data/cardQualityManager.js` (`pulledAt`), `main.js` (`prestige_pull_lines`)
* **Persistence Keys:** `tcg_archive_history`, `tcg_value_history`, `tcg_activity`, `tcg_recent_hits`
* **Timestamp Sources:**
  * `Date.now()` (for logs, array appending)
  * `new Date()` (daily snapshots in `todayKey` via `getFullYear`, `getMonth`, `getDate` - heavily dependent on local timezone boundaries)
* **Risks:**
  * **Timezone Drift:** `todayKey` uses local timezone methods, creating inconsistent snapshot aggregations if the player switches timezones or devices (e.g., cloud sync from a mobile device in a different timezone than a desktop).

---

## 3. Categorization

### Critical Timing Systems (Requires Normalization)
* **AGS Submissions** (`submittedAt`, `returnAt`, `gradedAt`)
* **Economy Timers** (`lastRefreshTs`, `lastDrift`, `lastClaimedTs`)
* **Vendor Events/Chases** (`eventEndsAt`, `expiry`)
* **Request Timers** (`lastRefresh`, `refreshedAt`)
* **Recovery Cooldowns** (`focusRotatedAt`, `lastReliefTs`)

### Cosmetic Timing Systems (Lower Priority for Normalization)
* **Activity Logs** (`tcg_activity`, `tcg_recent_hits` - recommended to be excluded from cloud sync payloads entirely)
* **History Keys** (`tcg_archive_history`, `tcg_value_history` - these can be synced, but conversion to ISO-8601 is less strictly required if omitted or truncated, though converting to ISO strings is still standard).
* **Card Quality `pulledAt`** (Historical metadata)

### Derived vs. Authoritative Timestamps
* **Authoritative:** `lastRefreshTs`, `returnAt`, `lastClaimedTs`. These govern gating logic.
* **Derived:** UI timer values resulting from `Math.max(0, target - Date.now())`. These are not persisted directly and rely entirely on authoritative timestamps.

---

## 4. Normalization and Migration Strategy

### 4.1 Canonical Representation
The Canonical Save Schema v1 should enforce that **all** `localStorage` timestamp values corresponding to critical systems be transformed into **UTC ISO-8601 strings** during serialization, and parsed back into **milliseconds (numbers)** during deserialization.

### 4.2 Adapter-Layer Normalization Opportunities
The normalization boundary exists strictly at `persistence/saveSchemaAdapter.js`.

**During Serialization (`serializeToCanonicalSave`):**
A traversal utility should walk the canonical payload object and convert integer timestamp keys (e.g., `lastRefreshTs`, `returnAt`) into ISO-8601 strings (`new Date(ms).toISOString()`).

**During Deserialization (`deserializeCanonicalSave`):**
The adapter should parse the ISO-8601 strings back to milliseconds (`Date.parse(isoString)`) before writing back to fragmented `localStorage` keys.

*Benefit:* This allows `Date.now()` arithmetic inside the various managers (runtime millisecond precision) to remain untouched, satisfying the requirement to avoid rewriting runtime logic.

### 4.3 Timezone Drift Risks and Solutions
* **`new Date().getDay()` (Vendor Availability):** Because this uses local time, the Broker might open early/late if the system clock changes. **Recommendation for future implementation (outside scope of this audit):** Derive "today" dynamically against a central UTC offset, rather than relying on `new Date().getDay()`.
* **Daily Keys (Stipend/Snapshot):** `Math.floor(Date.now() / 86_400_000)` is inherently UTC-safe because `Date.now()` is UTC ms since the epoch. However, the `todayKey` in `collectionValueHistory.js` uses local getters. **Recommendation:** Update `todayKey` to use `.toISOString().slice(0,10)` in future refactors to prevent timeline fragmentation.

### 4.4 Stale Restore and Cloud Conflict Strategies
* **Timers:** If an older save is fetched from Supabase, `lastClaimedTs` will move backward. This is inherently exploitable.
* **Recommendation:** The payload metadata should include an `updatedAt` ISO string. Before deserializing a canonical save over the local state, the `updatedAt` of the local save should be compared to the payload. If the local save is newer, prompt the user to resolve the conflict to avoid accidental rollbacks or stale timer exploitation.
* **AGS / Recovery State Locks:** AGS submissions from a stale save might re-lock cards that have since been graded on the local device. The save adapter must wholly overwrite the `tcg_ags_submissions` structure atomically to avoid partial state bleeding.

---
**Prepared For:** Rarebound Save Schema v1 Cloud Sync Migration Phase
**Scope:** AUDIT + NORMALIZATION PLANNING ONLY
