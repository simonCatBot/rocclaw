# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Cat profile avatars as a default avatar option alongside auto-generated Multiavatar SVGs
- System metrics time-series graph view (SystemGraphView) with Recharts — CPU, memory, GPU, VRAM, temperature charts with 5m/10m/30m time ranges
- Ed25519 device identity for cryptographic gateway authentication (challenge-response handshake, v3 format)
- Comprehensive unit tests for core business logic (145 test files, 1,091 tests)
- ROCm "Powered by" banner with version display in GPU metrics section
- Basic GPU fallback detection when ROCm is not installed (lspci + DRM sysfs)
- Start scripts (`start.sh`, `start.bat`) for build-and-release workflow
- Agent search/filter in Fleet Sidebar — search by name, ID, or model
- Tab state persistence to localStorage — active tabs restored on page refresh
- Skip navigation link for keyboard users ("Skip to main content")
- WAI-ARIA tablist keyboard navigation (Arrow keys, Home/End) for dashboard tabs
- Focus trap and Escape key support for AgentCreateModal
- Inline gateway URL validation with error messages on ConnectionPage
- Loading skeletons for SystemMetricsDashboard, TokenUsageDashboard, and TasksDashboard
- Error retry buttons for SystemMetricsDashboard and TasksDashboard
- Connection-loss and agent error banners in AgentChatPanel
- DnD screen reader announcements for TasksDashboard Kanban board
- `@media (prefers-reduced-motion: reduce)` to disable animations for motion-sensitive users
- ARIA attributes across all components: `role="tablist"`, `role="tab"`, `role="menu"`, `role="log"`, `aria-selected`, `aria-expanded`, `aria-label` on icon buttons, landmark elements (`<header>`, `<main>`, `<nav>`, `<footer>`, `<aside>`)
- `scrollbar-hide` CSS utility for hidden overflow scrollbars

### Fixed
- System metrics correctly showing "Remote" label when browser accesses rocCLAW from a remote machine
- System metrics no longer showing "Remote" on the host machine itself
- CPU display correctly shows physical cores vs logical threads
- Task avatar sync on page reload
- GPU detection for Strix Point iGPUs with mismatched rocm-smi indices
- Connection panel backdrop click not dismissing overlay
- Tasks tab toggle-off leaving zero visible tabs
- Shared copy status across all buttons in ConnectionPage
- Settings save button appearing to save read-only settings
- Token usage silently showing static fallback data without indication
- Missing space in footer gateway version display
- Chat composer focus indicator suppressed — now shows subtle focus glow
- FleetSidebar `filter`/`onFilterChange` props made optional (previously required but unused)
- Tab persistence validates stored tab IDs against valid values

## [1.0.0] — 2026-04-07

### Changed
- Codebase cleanup: removed dead components, unused exports, and test-only code paths
- Consolidated documentation into `docs/` directory
- Regenerated all documentation with accurate API route references and current architecture
- Updated README to industry-standard format with project logo

### Removed
- Dead components: `Gauge`, `ThemeToggle`, `SystemDashboard`, `SystemInfo`, `GatewayConnectScreen`
- Dead module: `src/lib/gateway/agentFiles.ts`
- Dead API route: `/api/system/metrics`
- Unused exports across 15+ modules (rate-limit, gateway-frames, message-extract, rocm, etc.)
- Redundant documentation files: `AGENTS.md`, `ui-guide.md`, `pi-chat-streaming.md`
- Agent plan files: `.agent/PLANS.md`, `.agent/README.md`, `.agent/REFACTOR_DEAD_CODE_CLEANUP.md`

### Fixed
- Duplicate CSS import block in `globals.css`
- Rate limit tests using shared keys causing cross-test state leakage

## [0.9.0-alpha.0] — 2026-04-06

### Alpha Preview

> This was the initial alpha release. Expect rough edges and breaking changes.

### Added
- Avatar system with auto-generated, default, and custom URL modes
- Fleet sidebar soul names from `IDENTITY.md`
- Footer avatar mode toggle persisted to localStorage
- `AgentCreateModal` with create/resume flows
- `AgentSettingsMutationController` for batched optimistic updates
- Fleet hydration with `deriveDefaultIndex` utility
- `agentFleetHydration` operation for fetching identity names
- Gateway version display in footer
- E2E test coverage for settings panel and bootstrap workflow

### Changed
- Fleet tile avatars increased to 96px with `object-cover` centering
- Fleet card layout with identity name as muted subtitle
- `identityName` field as single source of truth for display names
- Avatar mode context shared globally via `AvatarModeContext`

### Fixed
- Avatar centering overflow with `fill` mode
- Avatar sync on reload with consistent default images
- Identity name priority chain
- Footer default avatar index calculation
- `setState-in-effect` lint errors

### Infrastructure
- GitHub Actions CI pipeline (4 parallel jobs: lint+typecheck, unit tests, build, E2E)
- Playwright E2E test suite (11 specs)
- Vitest unit test suite (145 files, 1,091 tests)
- ESLint + TypeScript strict type checking
- Continuous release workflow on master pushes
- npm package distribution (`@simoncatbot/rocclaw`)
