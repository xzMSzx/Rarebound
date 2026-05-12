# Economy / Architecture Scan

Scope: economy integrity, reward ordering, source-of-truth paths, file growth, module ownership, and scaling pressure.

## Strong Signals

- Pack rewards still flow through `runPackOpening()` for normal pack acquisition.
- Economy drift is centralized in `economyManager` and `marketValue`.
- Vendor requests and emergency requests share eligibility logic, reducing duplicated criteria rules.
- Archive/value/history systems are bounded and generally pure persistence managers.

## Risks Found

### Collection value calculations undercount duplicates

`recordCollectionValueSnapshot()` and stats value logic iterate owned card IDs and add one market value per card ID, not `value * count`. This makes value history and collection value display represent unique-card value rather than owned-copy value, while other systems treat duplicates as economic inventory.

### Broker purchases bypass legacy `addCard()`

`runPackOpening()` updates both legacy `playerState.collection` and v2 collection. `buyChaseCard()` only calls `addCardToCollection()`. If any remaining UI or diagnostic code still reads legacy `playerState.collection`, broker cards will be invisible there.

### Milestone claims persist before rewards are applied

`autoClaimReadyMilestones()` saves claimed milestone IDs before `sweepMilestones()` applies rewards. If reward application fails after claim persistence, the milestone cannot naturally retry.

### Market drift/history writes are coupled

`tickMarketValues()` writes market values, meta, and history in sequence. If history write fails after values/meta save, the market remains usable but chart history desyncs.

### File growth is now a real maintainability risk

Largest files:

- `style.css` around 318 KB
- `main.js` around 150 KB
- `milestoneManager.js` around 31 KB
- `archiveServicesScreen.js` around 23 KB
- `settingsScreen.js` around 22 KB
- `marketScreen.js` around 20 KB

The project does not need a framework migration, but `main.js` has crossed the point where new feature work should avoid adding more unrelated ownership.

## Recommended Direction

- Clarify whether collection value means unique archive value or total owned-copy value; encode that as a named helper.
- Finish retiring or isolating legacy `playerState.collection`.
- Move request fulfillment, AGS entry panel, stats value calculation, and sell modal orchestration into focused controller modules over time.
- Add unit tests around economy operations with write-failure mocks.
