# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0-alpha.0] — 2026-04-06

### ⚠️ Alpha Preview

> **This is early, unstable software.** Expect rough edges, breaking changes, and incomplete features. Do not use in production environments.

### Added
- **Avatar system** — Per-agent avatar selection with auto-generated (multiavatar lib), default (12 PNG profiles), and custom URL modes; globally toggled from the footer
- **Fleet sidebar soul names** — Agent cards now display identity names fetched from each agent's `IDENTITY.md`, with improved card layout and sizing
- **Footer avatar mode toggle** — Quick dropdown to switch between auto/default/custom avatar sources; persists to localStorage
- **`AgentCreateModal` types** — Added `AgentCreationType` union (`create` | `resume`) for clearer creation vs. resumption flows
- **`AgentSettingsMutationController`** — New React controller hook for batched, optimistic agent settings updates with conflict resolution
- **Fleet hydration derivation** — `deriveDefaultIndex` utility shared across `FooterBar`, `TasksDashboard`, and fleet tiles for consistent avatar mapping across reloads
- **`agentFleetHydration` operation** — Fetches `IDENTITY.md` per agent at hydration time; shows soul names in fleet cards
- **Gateway version display** — Client-side fetch of OpenClaw gateway version displayed in footer
- **E2E test coverage** — Settings panel test using specific heading locator; bootstrap workflow tests

### Changed
- **Fleet tile avatars** — Increased from 80px to 96px; now fill card height with `object-cover` centering
- **Fleet card layout** — Identity name shown as muted subtitle above agent name; soul name bold/larger; agent name small and muted below
- **`identityName` field** — `agent.identity?.name` is now the single source of truth for display names across all components
- **`FooterBar` avatar toggle** — Now shows whenever agents exist (not only when an agent is running); aligned with global `AvatarModeContext`
- **`AgentAvatar` context** — Now reads `AvatarModeContext` so footer, fleet tiles, and task cards stay in sync
- **Avatar mode context** — Shared globally via `AvatarModeContext.tsx` to prevent stale state from `useEffect` localStorage reads
- **Seed hashing** — Default avatars use `seed + index` blending to ensure all agents get unique default images on each reload

### Fixed
- **Avatar centering** — `fill` mode avatars now use `relative` positioning with `object-cover` to prevent overflow
- **Avatar sync on reload** — Agents now get consistent (but distinct) default avatar images even after page reload
- **Identity name priority** — Fixed priority chain: `agent.identity?.name` → `agent.identityName` → derived from identity file
- **Footer default avatar** — Footer avatar in default mode now uses shared `deriveDefaultIndex` for correct index calculation
- **Lint errors** — Fixed `setState-in-effect` lint errors and resolved all remaining lint issues

### Infrastructure
- GitHub Actions CI pipeline for automated testing on push/PR
- Playwright E2E test suite with maximized browser window support
- Vitest unit test suite
- ESLint + TypeScript strict type checking
