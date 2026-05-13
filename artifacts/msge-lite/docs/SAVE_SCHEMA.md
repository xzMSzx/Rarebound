# SAVE_SCHEMA

## Purpose
This document defines the long-term cloud persistence structure and synchronization philosophy for Rarebound. As a premium collector-platform architecture, Rarebound relies on highly specific, per-copy data structures (e.g., hidden quality fingerprints, AGS grading data, prestige markers).

Cloud persistence is responsible for securing this high-value player data against local storage loss, enabling future multi-device access, and acting as the authoritative record for collector progression. Versioned saves and structured payloads are mandatory to ensure migration safety, prevent data corruption, and provide clear schema boundaries as the economy and collection mechanics evolve.

## Section 1 — Cloud Authoritative Data
The following systems represent persistent collector value and MUST be synchronized to the cloud:
- **Player Progression (`tcg_player_v2`):** Experience, current balance, and level. Represents the core identity and purchasing power.
- **Collection Ownership (`tcg_collection_v2`):** The definitive inventory of all owned cards, including unique per-copy metadata.
- **AGS Archive Data (`tcg_ags_submissions`):** Records of ongoing grading jobs and finalized premium slabs.
- **Favorites (`tcg_favorites`):** User-curated list of cosmetic identities and showcased cards.
- **Prestige & Milestones (`tcg_prestige`, `tcg_milestones`):** Long-term achievements and account-wide buff markers.
- **Archive History (`tcg_archive_history`):** Immutable log of significant collector events and acquisitions.

These elements belong in cloud storage because they constitute the "hard value" of a player's account. Losing this data equates to a complete loss of progress and collector identity.

## Section 2 — Local-Only Data
The following systems are transient or environment-specific and MUST NOT be synchronized:
- **Temporary UI State:** Scroll positions, active tab indices, modal visibility.
- **Animation State & Caches:** Flags indicating if a reveal animation has played, or cached DOM elements.
- **Transient Economy/Market State:** The current 30-minute market trend or vendor rotation timers (these are deterministically generated or globally governed).
- **Debug/Dev Settings:** Infinite balance flags, layout toggles, or diagnostic markers.

These elements remain local-only because they hold no long-term collector value, can cause state desyncs if restored on a different device, and needlessly inflate the payload size.

## Section 3 — Save Versioning
To guarantee migration safety and backward compatibility, every cloud payload must be wrapped in a versioned envelope.

- **`schemaVersion`:** An integer representing the structural format of the JSON payload. Incremented only when breaking changes occur to the save data structure.
- **`gameVersion`:** The semantic version of the game client that generated the save (e.g., "1.6.0").
- **`savedAt`:** An ISO 8601 timestamp of when the payload was constructed.

**Example Payload Structure:**
```json
{
  "schemaVersion": 1,
  "gameVersion": "1.6.0",
  "savedAt": "2026-05-13T12:00:00Z",
  "data": {
    "player": { ... },
    "collection": { ... },
    "ags": { ... },
    "favorites": [ ... ],
    "prestige": { ... },
    "archiveHistory": [ ... ]
  }
}
```

## Section 4 — Collection Structure
The collection is the most critical asset in Rarebound. The structure MUST preserve per-copy identity.

- **Per-Copy Identity:** Cards are not just integer counts. Every acquired card is a distinct entity with its own generation timestamp and acquisition source.
- **Hidden Quality Fingerprints:** Each copy holds a hidden seed (e.g., 1.0 to 10.0) generated at the moment of pulling. This dictates its future AGS grade.
- **AGS Relationships:** A card copy must maintain its linkage to its corresponding AGS slab if it has been graded or is currently in submission.

**Dangers to Avoid:**
- **Flattening Duplicate Cards:** Never compress multiple copies of the same card ID into a simple `count: 5`. This destroys the hidden quality fingerprints and makes grading impossible.
- **Losing Copy Identity:** Stripping metadata (like acquisition date or quality) turns a premium collection into a generic list.
- **Regenerating Metadata:** Re-rolling quality seeds upon cloud restore compromises the integrity of the collector's specific assets.

## Section 5 — Cloud Sync Rules
- **First-Time Sync Behavior:** When an authenticated user logs in and local save data is detected while the cloud save is empty, the system MUST NOT automatically upload. It must prompt the user with an explicit confirmation to sync their local collection to the cloud.
- **Duplicate Prevention:** A local flag (`tcg_sync_completed`) is used alongside cloud-empty detection to prevent redundant initial uploads.
- **Guest-Mode Behavior:** Unauthenticated users rely entirely on `localStorage`. The sync manager remains dormant.
- **Authenticated Behavior:** Once the initial sync is complete, future architecture will dictate automated delta or periodic syncing.
- **Sync Ownership Expectations:** A cloud save is strictly bound to the authenticated `user_id`. Payloads must never be orphaned or merged carelessly.

## Section 6 — Future Scalability
As Rarebound evolves, the save architecture must support:
- **Multi-Device Sync:** Allowing a collector to seamlessly move between mobile and desktop environments.
- **Cloud Restore Support:** Explicit UI flows to pull a cloud save down to a fresh device, overwriting local state only after user confirmation.
- **Save Separation:** Future iterations may split the monolithic payload into discrete database rows or documents (e.g., separating `PlayerProfile`, `CollectionInventory`, `AgsArchives`) to support partial syncing and reduce bandwidth.

## Section 7 — Important Architecture Rules
**DO:**
- Preserve structured, distinct save payloads.
- Preserve explicit copy identity and hidden metadata for all cards.
- Preserve schema and game version metadata in every sync.
- Centralize all cloud save logic within a dedicated module.

**DO NOT:**
- Blindly serialize and upload the entire `localStorage` object.
- Tightly couple unrelated systems into a single unversioned JSON blob.
- Lose AGS grading relationships during serialization or deserialization.
- Overwrite cloud data automatically without robust conflict resolution or explicit intent.
- Sync transient, device-specific, or temporary UI state.
