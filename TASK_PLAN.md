# rocCLAW Documentation Cleanup Plan

## Task
Clean up and reorganize rocCLAW documentation:
- Move all documentation to `docs/` folder
- Clean up the main README to be world-class
- Remove unused/old files
- Run tests to ensure nothing is broken
- Create a PR

## Plan

### Step 1: [SETUP] Create new branch
**Dependencies:** None
**Approach:** Create `docs-cleanup` branch for safe experimentation
**Verification:** `git branch` shows new branch
**Files:** N/A

### Step 2: [ANALYSIS] Inventory all documentation files
**Dependencies:** Step 1
**Approach:** List all markdown files, identify duplicates and orphaned content
**Verification:** Complete list categorized
**Files:** All *.md files in repo

### Step 3: [DECISION] Determine what stays where
**Dependencies:** Step 2
**Approach:** 
- Main README should be the entry point with quick start and key links
- docs/ folder should have all detailed documentation
- Move internal agent files to `.agent/` clearly marked as internal
- Keep contributing guide
**Verification:** Clear structure decided
**Files:** All documentation files

### Step 4: [IMPLEMENTATION] Move documentation to docs/
**Dependencies:** Step 3
**Approach:** 
- Move all user-facing documentation to docs/
- Rename/reorganize for clarity
- Create docs/ARCHITECTURE.md, docs/CONTRIBUTING.md, etc.
**Verification:** All docs in correct locations
**Files:** docs/*.md

### Step 5: [CLEANUP] Rewrite main README
**Dependencies:** Step 4
**Approach:** Create a world-class README with:
- Clear one-liner description
- Badges (if meaningful)
- Quick start (3 steps max)
- Feature overview
- Link to full documentation
- Contributing section
- License
**Verification:** README is clean, complete, inviting
**Files:** README.md

### Step 6: [CLEANUP] Remove unused/old files
**Dependencies:** Step 5
**Approach:** 
- Identify files that are redundant or outdated
- Remove them with explanation
**Verification:** No orphaned documentation
**Files:** TBD after analysis

### Step 7: [TESTING] Run all tests
**Dependencies:** Step 6
**Approach:** Run lint, typecheck, and tests to ensure no breakage
**Verification:** All tests pass
**Commands:** npm run lint && npm run typecheck && npm run test

### Step 8: [REFINEMENT] Self-critique and iterate
**Dependencies:** Step 7
**Approach:** Review README against best practices, iterate if needed
**Verification:** README is the best it can be
**Files:** README.md

### Step 9: [SUBMISSION] Create PR
**Dependencies:** Step 8
**Approach:** Push branch and create PR with clear description
**Verification:** PR created on GitHub
**Commands:** git push, gh pr create

## Risk Analysis
**Potential blockers:**
- Documentation dependencies (links might break)
- Tests might fail on cleanup

**Mitigation:**
- Use find/replace to update internal links
- Run full test suite before PR

## Rollback Plan
**If fails:** `git checkout main && git branch -D docs-cleanup` to start fresh