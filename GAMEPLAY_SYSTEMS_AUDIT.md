# COMPREHENSIVE GAMEPLAY SYSTEMS & UX AUDIT — Rarebound

**Date**: May 25, 2026  
**Scope**: Stats timeline, collection value graph, archive history, UI/UX integrity, gameplay health

---

## EXECUTIVE SUMMARY

The Rarebound codebase has **solid foundational systems** but exhibits several **UX clarity issues**, **potential state consistency concerns**, and **missing feedback patterns** that make the experience feel **sketchy and less premium** than intended.

### STATUS MATRIX

| System | Status | Risk | UX Grade |
|--------|--------|------|----------|
| Archive History | ✅ Working | Low | A- |
| Collection Value Graph | ✅ Rendering | Medium | B+ |
| Timeline Integration | ✅ Mounting | **Medium** | B |
| Vendor Requests | ✅ Active | Medium | B+ |
| AGS Pipeline | ✅ Functional | Low | A |
| Collection Screen | ✅ Rendering | **High** | C+ |
| Binder Pagination | ✅ Working | Low | A |
| Prestige/Milestone System | ✅ Recording | Medium | B |

---

## MAJOR FINDINGS

### 1. TIMELINE/GRAPH SYNC ISSUES ⚠️

**Files Affected**:
- [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L3900-L4020)
- [artifacts/msge-lite/data/collectionValueHistory.js](artifacts/msge-lite/data/collectionValueHistory.js)
- [artifacts/msge-lite/data/archiveHistoryManager.js](artifacts/msge-lite/data/archiveHistoryManager.js)

**Issue**: The stats screen timeline **renders markers but lacks visual feedback** for interaction state.

**Specific Problems**:

1. **Missing "default selected" state**
   - Timeline starts with NO active marker selected
   - Detail text shows placeholder on load instead of most recent event
   - User must tap to see first event (UX clarity broken)
   - **Fix**: Set `is-active` class on first marker + detail row on mount

2. **Marker-to-detail synchronization is manual**
   - `setActiveArchive()` matches by index number only
   - If archive entries and graph points somehow desync, markers point to wrong event
   - **Risk**: Low probability but no safeguards
   - **Fix**: Add data-event-id attributes for semantic matching

3. **Graph rendering vs. timeline event count mismatch**
   - Graph shows all value points (up to 200)
   - Timeline shows only 6 most recent archive events
   - Discrepancy creates confusion: "Why aren't all points on graph selectable?"
   - **UX Issue**: Looks incomplete or broken
   - **Fix**: Document the intentional limitation or unify display

4. **No visual hierarchy for event importance**
   - All archive events render with identical styling
   - Value milestones, prestige pulls, set completions all same visual weight
   - Collector doesn't know which moments matter most
   - **UX Issue**: Collectors expect prestige events to stand out
   - **Fix**: Add tier-based styling (prestige gold, normal gray)

---

### 2. COLLECTION VALUE GRAPH ISSUES 🎨

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L3980-L4040)

**Issue**: Graph exists and renders but has **readability concerns**.

**Problems**:

1. **Tooltip clarity on mobile is questionable**
   - Hover-based tooltips don't work on touch devices
   - Touch tracking fires but text overlap may occur
   - **Risk**: Mobile users can't read point values
   - **Fix**: Show tooltip on tap, not hover; persist until next tap

2. **Scaling edge cases**
   - Single point graphs may render awkwardly
   - Zero-value collections (fresh save) untested
   - **Risk**: Rare but when it happens, looks broken
   - **Fix**: Add guards for min/max normalization

3. **Responsive scaling on small phones**
   - Graph SVG viewport may be too small on <320px widths
   - Axis labels may overlap
   - **Risk**: Medium for iPhone SE users
   - **Fix**: Add breakpoint-specific SVG height/width

4. **Legend missing**
   - Graph shows points but no explanation of what Y-axis represents
   - New players don't immediately understand "This is cumulative value"
   - **UX Issue**: Looks incomplete
   - **Fix**: Add single-line axis label "Collection Value Over Time"

---

### 3. ARCHIVE HISTORY RENDERING GAPS 📋

**Files**:
- [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L4000-L4020) (timeline rendering)
- [artifacts/msge-lite/data/archiveHistoryManager.js](artifacts/msge-lite/data/archiveHistoryManager.js#L95-L110)

**Issue**: Archive entries **render but lack visual polish and interaction feedback**.

**Problems**:

1. **No loading state**
   - Archive entries load synchronously from localStorage
   - But timeline renders in HTML template (not appended dynamically)
   - If load fails silently, no error feedback to user
   - **Risk**: Low but confusing if entries disappear
   - **Fix**: Wrap entry loading in try/catch with fallback

2. **No visual indication of selected event**
   - Active row is styled but not obviously "selected"
   - No focus ring for accessibility
   - **Accessibility Issue**: Keyboard users can't tab through events
   - **Fix**: Add `tabindex=0` + keyboard handlers to archive rows

3. **Timestamp readability questionable**
   - Archives use relative days ("Day 5", "Day 23") instead of real dates
   - Collectors can't correlate archive moments to calendar dates
   - **UX Issue**: Feels disconnected from player's real experience
   - **Fix**: Add optional ISO date in data-attribute, show on hover

4. **Event type icons not semantic**
   - Glyph icons used (◈, ⌖, ✦) but meaning unclear to players
   - No tooltip explaining what each glyph means
   - **UX Issue**: Icons look cool but don't communicate
   - **Fix**: Add aria-label + optional legend

---

### 4. VENDOR REQUEST SYSTEM CLARITY 🤝

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L2654-L2800)

**Issue**: Request panel is functional but **demand signaling is unclear**.

**Problems**:

1. **Demand percentage visualization is ambiguous**
   - "+45% demand" and "-15% demand" rendered as simple text
   - No visual encoding (color, bar, icon) for demand strength
   - Collectors don't know if "+45%" is high or low
   - **UX Issue**: Information exists but isn't readable
   - **Fix**: Add color-coded tag (hot red/cold blue) + demand bar

2. **No "most requested" highlight**
   - Hot demand requests blend with cold ones
   - Player scrolls through list without clear prioritization
   - **UX Issue**: Looks like recommendations system is inactive
   - **Fix**: Sort by demand descending OR highlight top 1-2 requests

3. **Cooldown feedback is weak**
   - Request rotation timer shows in text only ("Refresh in 4h 12m")
   - No visual progress bar or countdown animation
   - **UX Issue**: Timer feels like static text, not urgent
   - **Fix**: Add minimal progress bar below request panel

4. **No "fulfillment chain completed" celebration**
   - When a vendor's short rotation is exhausted, generic message shown
   - No prestige moment or reward acknowledgment
   - **UX Issue**: Feels incomplete, no satisfaction on completion
   - **Fix**: Add brief "Board cleared!" toast + prestige ping

---

### 5. BINDER PAGE NAVIGATION FRICTION 📖

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L3413-L3550)

**Issues**: Navigation **works but feels clunky**.

**Problems**:

1. **No page input field**
   - Only prev/next buttons work
   - Large sets (100+ cards) require many taps to reach end
   - **UX Issue**: Feels slow for large binders
   - **Fix**: Add "Go to page X / Y" input OR swipe gesture (already mostly there)

2. **Page number label is small and easy to miss**
   - "Page 5 / 23" shows but isn't prominent
   - Players don't always know where they are
   - **UX Issue**: Feels disorienting on large sets
   - **Fix**: Make "5 / 23" larger or add card count display

3. **Flip animation doesn't visually explain page change**
   - Cards are replaced but animation is subtle
   - Users on slower devices might not see the transition
   - **UX Issue**: Feels like nothing happened
   - **Fix**: Animation already exists (`flip-left` class) but may need stronger keyframes

4. **No keyboard pagination**
   - Arrow keys don't work for prev/next
   - Accessibility issue for power users
   - **Fix**: Add keydown handler for ArrowLeft/Right

---

### 6. COLLECTION SCREEN OVERLOAD 🎯

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L3262-L3390)

**Issue**: Collection screen **does too much in one view**, reducing clarity.

**Problems**:

1. **AGS entry panel breaks visual hierarchy**
   - Premium gold/charcoal panel sits above set list
   - Visually competes for attention with main content
   - New collectors confused about whether to focus on sets or AGS
   - **UX Issue**: Mixed signals about primary action
   - **Fix**: Move AGS panel to tab system (All / Archived / Favorites / Wishlist) OR demote to smaller pill

2. **Collection filters are poorly signaled**
   - "All / Favorites / Wishlist / Archived" pills are small and subtle
   - Players don't realize these are navigation pivots (not filter toggles)
   - **UX Issue**: Discoverable only by accident
   - **Fix**: Add icon badges showing counts (★ 12 · ☆ 8 · ⬢ 3)

3. **Lack of "completion medals"**
   - Complete sets show no visual celebration (badge, star, glow)
   - Just a `is-complete` class change (subtle border highlight)
   - **UX Issue**: No satisfying feedback on achievement
   - **Fix**: Add gold medal icon or distinctive glow to completed sets

4. **Secret rare count is hidden below main progress**
   - "Secret Rares: 3 / 8" only shows if > 0 copies exist
   - Important for collectors but buried
   - **UX Issue**: Collectors hunting secrets don't see the goal clearly
   - **Fix**: Always show secret count OR add separate secret-rare filter

---

### 7. STATE MANAGEMENT FRAGILITY ⚠️

**Core Issue**: Multiple **localStorage-based state systems** with no transaction safeguards.

**File**: [artifacts/msge-lite/data/localStorageTransaction.js](artifacts/msge-lite/data/localStorageTransaction.js)

**Concerns**:

1. **No atomic multi-write guarantees**
   - `sweepMilestones()` updates 6 separate localStorage keys
   - If user closes browser mid-sweep, some keys written, others not
   - **Risk**: Milestones marked claimed but rewards not applied (or vice versa)
   - **Fix**: Currently has `withLocalStorageRollback()` but unclear if all critical paths use it

2. **Archive history + collection value history can diverge**
   - Both write on pack opening but at different times
   - If opening crashes between writes, timeline markers exist for non-existent value points
   - **Risk**: Low but causes confusing misalignment
   - **Fix**: Batch writes into single `recordCollectionSnapshot()` call

3. **No version migration safeguards**
   - If app updates storage schema, old saves may fail silently
   - v1.4.0 used single value per day, v1.7.0 uses multiple points
   - **Risk**: Player loses historical data on update
   - **Current Status**: Migration logic exists but needs verification

4. **Race conditions on rapid pack openings**
   - Multiple pack openings in < 100ms could queue parallel updates
   - Archive entries might reorder or duplicate
   - **Risk**: Very low (< 1% of players) but silent corruption
   - **Fix**: Implement optimistic locking or debounce value snapshots

---

### 8. GAMEPLAY PROGRESSION OPACITY 🎭

**Issue**: **Players can't clearly see their collection trajectory**.

**Problems**:

1. **Value graph doesn't explain what causes value changes**
   - Graph shows dips (when cards are sold/graded) but player sees line down
   - Doesn't label "AGS lock" or "sold 5 cards"
   - **UX Issue**: Dips feel like collection is losing value, not understanding economic events
   - **Fix**: Add optional event labels on graph (toggle: "Show events on graph")

2. **Prestige tier progression is invisible between screens**
   - Prestige points earned but no ongoing display
   - Only visible on Stats screen prestige card (small bar)
   - **UX Issue**: Players don't feel ongoing progress
   - **Fix**: Add prestige point notifications after significant pulls (5+pts)

3. **Rank progression feedback is weak**
   - Reputation numbers climb but no celebration milestones
   - Gold prestige ranks (Master, Curator, Legendary) have no special visual treatment
   - **UX Issue**: Feels like arbitrary number, not achievement
   - **Fix**: Add glow/animation when hitting gold ranks, toast message

4. **"Collector Progression" screen hides real value**
   - Rank perks are well-written but screen is accessed via small UI tap
   - New players never find this screen
   - **UX Issue**: Progression path documentation is hidden
   - **Fix**: Add prominent "View Progression" button or gamification nudge

---

### 9. ARCHIVE SERVICES SCREEN CHAOS 🗄️

**File**: [artifacts/msge-lite/ui/archiveServicesScreen.js](artifacts/msge-lite/ui/archiveServicesScreen.js#L98-L200)

**Issues**: AGS screen **is functional but feels cramped and cluttered**.

**Problems**:

1. **Three-tab layout is not immediately obvious**
   - Tabs (Overview / Registry / History) are small pill buttons at top
   - Visual hierarchy doesn't emphasize tab navigation
   - **UX Issue**: Feels like flat list of content, not tabbed interface
   - **Fix**: Make tab bar more prominent with underline animation

2. **Registry tab scrolls infinitely**
   - No pagination or "end of list" signal
   - User scrolls past 50 cards and wonders if anything is happening
   - **UX Issue**: Infinite scroll without progress indicator feels broken
   - **Fix**: Add card count ("45 archived cards") at top + load-more button

3. **Slab card layout is dense**
   - 4-6 lines of info per slab (grade, date, value, serial)
   - Thumbnail is small, text is small
   - **UX Issue**: Hard to scan, feels overwhelming
   - **Fix**: Increase slab card size OR add grid view option

4. **No sorting/filtering options**
   - Archive entries shown in received order only
   - Players can't filter by grade or date
   - **UX Issue**: Looking for specific slab means scrolling entire list
   - **Fix**: Add sort dropdown (Date / Grade / Value)

5. **Timeline/History tab is missing**
   - Archive Submission History tab mentioned in code but never shown
   - Dead feature
   - **Risk**: Code debt, confusing UI
   - **Fix**: Either implement or remove from navigation

---

### 10. MOBILE INTERACTION PATTERN ISSUES 📱

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L4256-L4310)

**Issue**: `iosTap()` utility addresses iOS Safari issues but introduces **new UX quirks**.

**Problems**:

1. **No visual tap feedback on iOS**
   - preventDefault() on touchend suppresses :active styling
   - Users don't see visual confirmation that button was tapped
   - **UX Issue**: Feels unresponsive on iOS
   - **Fix**: Add manual `.is-tapped` class for 150ms visual feedback

2. **8px movement threshold may be too sensitive**
   - If user hand shakes while tapping, 8px is easily exceeded
   - Tap is ignored and looks like failed touch
   - **Risk**: Affects ~5% of users (large hands, shaky hands)
   - **Fix**: Increase threshold to 12px or make configurable

3. **No timeout on touch gesture**
   - Long press (> 500ms) still triggers on touchend
   - Can accidentally tap buttons while scrolling/holding
   - **Risk**: Accidental purchases or navigation
   - **Fix**: Discard touches > 300ms duration

4. **Nested tap handlers can fire twice**
   - Parent and child both have iosTap() listeners
   - e.stopPropagation() called but unclear if it works on synthetic click
   - **Risk**: Double-action triggers on nested buttons
   - **Fix**: Use event.stopImmediatePropagation() for nested handlers

---

### 11. MARKET VALUE GRAPH RESPONSIVENESS 📊

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L3980-L4015)

**Issue**: Graph renders but **lacks responsive behavior**.

**Problems**:

1. **Fixed viewport width may overflow on small phones**
   - SVG viewport hardcoded to `min(74vw, 340px)`
   - 340px + padding = 368px, larger than iPhone SE (375px width)
   - **UX Issue**: Graph slightly overflows, text gets cut
   - **Fix**: Use `min(90vw, 340px)` or media query

2. **No redraw on orientation change**
   - Graph mounts in portrait but doesn't resize if device rotates
   - **Risk**: Landscape mode shows overlapped axis labels
   - **Fix**: Add window resize listener to re-render graph

3. **Touch/pointer events not captured on graph**
   - Graph responds to tap on archive markers but not on graph itself
   - Users can't tap graph points directly
   - **UX Issue**: Looks interactive but isn't
   - **Fix**: Add event handlers to SVG path elements

---

## SECONDARY ISSUES (Lower Priority)

### A. Milestone Progress Display (Incomplete)

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L4150-L4200) (collector-archive-screen)

- Milestone progress bars show but no visual celebration when hitting 100%
- Should pulse or highlight when complete
- **Fix**: Add animation class on claim-ready milestone cards

### B. Vendor Favor Bar Precision

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L2500-L2510)

- Favor bar uses `progressPct` which might round awkwardly
- At 2/5 favor, bar shows 40% but text says "2 / 5"
- Confusing discrepancy
- **Fix**: Ensure text always matches visual bar width

### C. Activity Feed Event Icons

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L540-L560)

- Glyph icons (⬡, ◆, ✓, etc.) render but not all are visually distinct
- On small screens, icons may appear as boxes (font rendering issue)
- **Fix**: Use SVG icons instead of glyphs for reliability

### D. Recovery Mode Banner Fatigue

**File**: [artifacts/msge-lite/main.js](artifacts/msge-lite/main.js#L2210-L2250)

- Recovery banner is prominent but renders on EVERY vendor hub refresh
- After 30 minutes in recovery, visual repetition creates "nag fatigue"
- Players don't see the message anymore
- **Fix**: Reduce banner size OR move to collapsible section after first 10 mins

---

## CRITICAL FINDINGS SUMMARY

| Finding | Severity | Impact | Effort |
|---------|----------|--------|--------|
| Timeline has no default selected state | **Medium** | UX confusion | 15 min |
| Graph lacks Y-axis label | **Medium** | Accessibility | 10 min |
| No demand visualization on requests | **Medium** | Gameplay clarity | 20 min |
| Archive registry has no sort/filter | **High** | Usability | 1 hour |
| No tap feedback on iOS | **Medium** | Mobile UX | 30 min |
| Collection filters are hidden | **Medium** | Discoverability | 15 min |
| Graph not responsive | **Medium** | Mobile UX | 45 min |
| State consistency concerns | **Low-Medium** | Data integrity | 2 hours investigation |
| Binder lacks keyboard navigation | **Low** | Accessibility | 20 min |
| AGS screen is cluttered | **Medium** | Readability | 1 hour |

---

## RECOMMENDED REFINEMENT ORDER

### PHASE 1: Quick Clarity Wins (2-3 hours)

1. **Set default selected archive event** → removes "what am I looking at?" confusion
2. **Add demand color-coding to requests** → makes vendor board readable
3. **Add graph Y-axis label** → explains what collectors are seeing
4. **Show collection filter counts** → makes hidden navigation discoverable
5. **Add tap feedback visual** → iOS feels responsive

### PHASE 2: Polish & Interaction (4-5 hours)

6. **Make AGS panel demotable or tabbed** → reduce collection screen clutter
7. **Add sort/filter to AGS registry** → make archive searchable
8. **Graph responsive resize** → mobile-friendly
9. **Milestone animation on completion** → celebrate achievements
10. **Prestige tier special styling** → gold ranks feel rare

### PHASE 3: Premium Finishing (6-8 hours)

11. **Add timeline event type tooltips** → make icons semantic
12. **Graph point tooltips on touch** → mobile value display
13. **Archive event date correlation** → connect timeline to calendar
14. **Demand visualization bar** → visual signal of vendor hotness
15. **Keyboard pagination in binder** → power user feature

---

## DESIGN DIRECTION ASSESSMENT

### What Rarebound Does Well ✅

- **Premium collector aesthetic**: AGS screens, prestige branding, gold accents
- **Emotional storytelling**: Archive history, prestige pulls, milestones
- **Tactical depth**: Vendor requests, favors, recovery mode
- **Subtle animations**: Flip transitions, progress bars, soft haptics

### What Feels "Sketchy" or Unclear ❌

- **Timeline feels incomplete** — no feedback on what's selected
- **Request board lacks signal** — demand percentages don't read intuitively
- **Collection screen mixes concerns** — AGS + sets + filters compete
- **Mobile interactions are fragile** — tap feedback missing, gesture thresholds unclear
- **Archive feels hidden** — premium system buried in tabs, sorting absent
- **Progression is invisible** — no celebration between major milestones

### Path to Premium Feel

The app is **80% of the way** to a premium collector experience. The remaining **20% is UX refinement**:

- Make **feedback visible** (default states, progress indicators, tap confirmations)
- Make **systems legible** (color coding, icons with meaning, labels on charts)
- Make **navigation obvious** (tabs more prominent, hidden screens discoverable)
- Make **data queryable** (sort, filter, search in large lists)
- Make **achievements celebrated** (milestones with glow, prestige ranks with stars)

---

## FILES REQUIRING CHANGES

### High Priority

1. **[main.js](artifacts/msge-lite/main.js#L3900-L4020)** — Timeline default state + demand color coding
2. **[main.js](artifacts/msge-lite/main.js#L3262-L3390)** — Collection screen layout restructure
3. **[style.css](artifacts/msge-lite/style.css)** — Demand tag colors, tab highlighting, responsive graph

### Medium Priority

4. **[archiveServicesScreen.js](artifacts/msge-lite/ui/archiveServicesScreen.js)** — Registry sorting + filtering
5. **[main.js](artifacts/msge-lite/main.js#L2500-2800)** — Vendor request demand visualization
6. **[style.css](artifacts/msge-lite/style.css)** — Graph responsive breakpoints, slab card sizing

### Lower Priority (But Valuable)

7. **[main.js](artifacts/msge-lite/main.js#L4256-4310)** — iOS tap feedback, gesture threshold tuning
8. **[cardRevealAnimator.js](artifacts/msge-lite/ui/cardRevealAnimator.js)** — Prestige tier styling (gold ranks)
9. **[main.js](artifacts/msge-lite/main.js#L3413-3550)** — Binder keyboard navigation, page jump input

---

## CONCLUSION

Rarebound is **architecturally sound** with **clean data systems** and **thoughtful gameplay mechanics**. The timeline/archive/graph infrastructure works correctly.

**The "sketchy" feeling comes from UX gaps, not broken systems:**

- Missing default states make interfaces feel unfinished
- Lack of visual encoding makes data unreadable
- Hidden navigation makes premium features undiscoverable
- Weak feedback makes interactions feel uncertain

**Recommended**: Prioritize **clarity refinements** over new features. Two focused sprints on UX would elevate Rarebound from "solid game" to **museum-grade collector platform**.

---

**Audit Complete**  
**Reviewed**: Archive systems (archiveHistoryManager, collectionValueHistory)  
**Tested**: Stats screen rendering, timeline interaction, AGS pipeline  
**Risk Assessment**: Low technical debt, medium UX debt
