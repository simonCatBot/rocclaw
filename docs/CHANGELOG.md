# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- GitHub Actions CI pipeline
- Playwright E2E test suite
- Vitest unit test suite
- ESLint + TypeScript strict type checking
