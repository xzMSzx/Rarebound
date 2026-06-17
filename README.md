# Rarebound

A digital Pokemon trading card collection game built in Vite.

## Overview

Rarebound is a premium, web-based collector platform simulating the thrill of opening, grading, and trading digital cards. Designed with a deep focus on tactical gameplay, collection value progression, and atmospheric UX, Rarebound allows players to:

- Open packs and reveal cards with immersive cinematic animations.
- Submit cards for AGS (Archive Grading Service) to receive permanent slabs with historical records.
- Track their collection's market value over time through interactive value graphs and timeline archives.
- Complete vendor requests and manage reputation to earn rewards and rare pulls.
- Achieve milestones and climb through prestige tiers as their collection grows.

## Core Features

- **Pack Opening & Cinematic Reveals:** Immersive pack opening experience with touch interactions, audio cues, and visual tiers driven by CSS keyframes.
- **AGS Pipeline:** A full grading service simulation where cards receive condition grades, impacting their market value and adding to an immutable archive history.
- **Vendor Request System:** Fulfill dynamic card requests from vendors, managing demand signaling and cooldown rotations.
- **Collection & Market Economics:** Track card values, historical market drift, and overall collection worth via timeline events and charts.
- **Prestige System:** Earn prestige points, climb collector ranks (Master, Curator, Legendary), and claim milestone rewards.
- **Offline-First Persistence:** Built on robust `localStorage` state management with scoped operations to handle thousands of cards efficiently.

## Architecture

Rarebound is designed around a vanilla JS and modular hybrid architecture.

- **Frontend Build Tool:** Vite
- **Package Manager:** pnpm
- **Frameworks:** Hybrid setup utilizing vanilla JavaScript modules for high-performance UI and core engine, alongside React and Tailwind CSS for specific UI components.
- **Data Persistence:** `localStorage` with operation-scoped caching and transactional safeguards to ensure consistency across multiple stores (e.g., collection counts, archive history).
- **Testing:** Unit testing configured via Vitest with jsdom environment for direct `localStorage` manipulation.

## Project Structure

This repository uses a pnpm workspace structure:

- `/artifacts/msge-lite/` - The core application codebase.
  - `/src/` - React components and Radix UI primitives.
  - `/ui/` - Vanilla JavaScript UI modules (e.g., card reveal animators, timeline rendering).
  - `/engine/` & `/data/` - Pure game rules, persistence managers, and cache logic.
- `/artifacts/mockup-sandbox/` - Sandbox workspace.

## Development Guide

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [pnpm](https://pnpm.io/)

### Setup

Install workspace dependencies from the root directory:

```bash
pnpm install
```

### Running the Application

The main app is located in `artifacts/msge-lite`. To start the local development server:

```bash
pnpm --dir artifacts/msge-lite dev
```

*(Alternatively, you can `cd artifacts/msge-lite` and run `pnpm dev`)*

The application will typically be served on `http://localhost:5173`.

### Testing

Tests are written using Vitest. To run tests within the `msge-lite` workspace:

```bash
pnpm --dir artifacts/msge-lite test
```

To run typechecking across workspaces:

```bash
pnpm run typecheck
```

## Known Issues & UX Roadmap

The gameplay systems are fundamentally sound, but the following areas have been identified for future UX/UI refinement:

- **Timeline/Graph Sync:** Timeline events lack visual feedback for selection state and missing Y-axis labels on the value graph.
- **Vendor Requests:** Demand percentages need visual encoding (e.g., color-coded bars) to indicate strong vs. weak demand clearly.
- **Collection Navigation:** The collection screen mixes multiple concerns (AGS, sets, filters) and could benefit from stronger visual hierarchies (e.g., tabbed AGS panels, completion medals).
- **Mobile Interaction:** Refining the iOS tap utility (`iosTap()`) to provide immediate visual feedback and adjusting threshold sensitivities to prevent missed interactions.

For a comprehensive view of the system architecture and current audit status, refer to `ARCHITECTURE_NOTES.md` and `GAMEPLAY_SYSTEMS_AUDIT.md`.

## License

MIT
