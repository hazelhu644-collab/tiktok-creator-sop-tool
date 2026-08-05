# App Component Split Design

## Status

Approved for planning on 2026-08-04. This document defines a behavior-preserving refactor. It does not authorize implementation until the written design is reviewed and a separate implementation plan is approved.

## Context

`src/App.tsx` currently contains approximately 5,241 lines. The `App` function accounts for approximately 4,597 lines and combines navigation, top-level state, derived data, persistence coordination, business operations, API interactions, error handling, and page rendering.

The largest rendering functions are approximately:

- `renderDashboard`: 779 lines
- `renderSettings`: 750 lines
- `renderCreatorDatabase`: 479 lines
- `renderTemplates`: 121 lines

Changing `App.tsx` has a high blast radius across creator workflows, Campaign matching, message generation, persistence, and integration tests. The refactor therefore prioritizes regression reduction over minimizing line count.

## Priorities

The agreed priorities are:

1. Reduce regression risk when changing features.
2. Improve readability and maintainability.
3. Prepare clear boundaries for future feature work.
4. Improve support for parallel development.

## Goals

- Separate major page rendering responsibilities from `App.tsx`.
- Preserve a single, explicit source of truth during the first phase.
- Define typed feature boundaries that can be understood and tested independently.
- Keep each change small enough to review, verify, merge, or revert independently.
- Create evidence for deciding whether business hooks should be extracted in a later phase.

## Non-Goals

This refactor will not:

- Change UI layout, labels, interaction order, or product behavior.
- Add, remove, or redesign features.
- Change priority, Campaign matching, video fulfillment, archive, or restore rules.
- Change `localStorage` keys, schemas, migration behavior, or persistence timing.
- Change DeepSeek or OpenAI request behavior, fallback behavior, or error messages.
- Introduce Context, Redux, another state library, or new dependencies.
- Remove functions based only on static unused-code suggestions. JSX event handlers must be verified through source and tests.
- Combine unrelated bug fixes with component extraction.

## Chosen Approach

Use a two-stage, page-first refactor.

### Stage 1: Extract Controlled Page Components

`App.tsx` remains the state and business-operation coordinator. Extracted components receive read-only data, UI state, and callbacks through typed props. They do not become independent state owners.

Target structure:

```text
src/
  App.tsx
  features/
    dashboard/
      DashboardPage.tsx
    creators/
      CreatorDatabasePage.tsx
    campaigns/
      CampaignSettingsPage.tsx
    messaging/
      MessageComposer.tsx
```

Smaller Templates, Samples, Review, and Ads views may also move into feature-local page files after the four primary boundaries are stable.

### Stage 2: Evaluate Business Hooks

Business hooks are optional and begin only after Stage 1 is merged and stable. Each hook requires a separate design check and pull request. Stage 1 may be considered sufficient; line-count reduction alone does not justify Stage 2.

Potential order:

1. `useMessageComposer`
2. `useCampaignManagement`
3. `useCreatorOperations`

`useCreatorOperations` is last because it connects creator records, work queues, archives, video fulfillment, and history.

## Data Flow

Stage 1 preserves the existing one-way data flow:

```text
App.tsx
  -> loads persistent data
  -> owns React state
  -> calculates derived data
  -> executes business operations
  -> passes data, UI state, and actions to feature pages
  -> receives user events through callbacks
  -> updates state and persistence
```

Extracted pages must not:

- Read or write `localStorage` directly.
- Call DeepSeek or OpenAI directly.
- Reimplement priority or Campaign rules.
- Maintain a second copy of creators, Campaigns, or stores.
- Use effects to mirror parent state.
- Change the order in which existing callbacks update state and persistence.

## Component Contracts

Each feature page uses a local typed prop contract grouped by responsibility:

```ts
type FeaturePageProps = {
  data: FeaturePageData;
  uiState: FeaturePageUiState;
  actions: FeaturePageActions;
};
```

- `data` contains read-only records and derived values needed for rendering.
- `uiState` contains controlled search, filter, selection, expansion, loading, and error state.
- `actions` contains only operations the page can trigger.

Contracts must not expose the full internal state of `App`. If a feature requires an unrelated field or action, review the boundary rather than passing a catch-all object.

## Error Handling

- API errors remain caught by `App.tsx` during Stage 1.
- Toast ownership remains at the application shell.
- Loading, error, and disabled states are passed to feature components.
- Existing error copy and local fallback behavior remain unchanged.
- Extracted components may render error state but may not reinterpret or replace it.

## Pull Request Sequence

GitHub Actions CI must be active on `main` before the first extraction PR.

### PR 1: Creator Database Page

- Extract Creator Database JSX into `CreatorDatabasePage`.
- Keep filtering, bulk operations, record updates, archive, restore, and persistence in `App.tsx`.
- Add focused tests for rendered data and callback wiring without removing integration coverage.

### PR 2: Campaign Settings Page

- Extract store and Campaign settings JSX into `CampaignSettingsPage`.
- Keep Campaign creation, duplication, rename, store assignment, archive, restore, delete, identity matching, and persistence in `App.tsx`.

### PR 3: Message Composer

- Extract creator reply, translation, English-message editing, and message status UI into `MessageComposer`.
- Keep API calls, local fallback generation, validation, state transitions, and tracking updates in `App.tsx`.

### PR 4: Dashboard Page

- Extract the workbench and follow-up center into `DashboardPage` after the first three contracts are stable.
- Keep queue processing, video progress changes, outcomes, history updates, and Campaign-specific requirements in `App.tsx`.

### PR 5: Smaller Pages and App Shell

- Extract Templates, Samples, Review, Ads, navigation, and application shell where their boundaries are purely presentational.
- Leave top-level state, derived data, business operations, and module coordination in `App.tsx`.

Each PR starts from the latest `main`, merges before the next begins, and must be independently revertible. Stacked feature branches are not used.

## Verification Strategy

`src/App.test.tsx` remains the integration-level behavioral safety net. Existing assertions are not removed or broadly rewritten merely because code moved.

Each extracted component receives only focused tests for:

- Critical data rendering.
- Controlled input behavior.
- User-event callback wiring.
- Loading, disabled, and error presentation when applicable.

Every PR must run under Node.js 22:

```bash
npm ci
npm test
npx tsc --noEmit --pretty false
npm run build
```

The current test count is treated as a floor. A reduction from 176 tests is a failure unless an explicitly obsolete test is separately reviewed and approved. Snapshot updates must not be used to conceal UI changes.

## Success Criteria

Stage 1 succeeds only when:

- Existing features, labels, routes, and interaction entry points are unchanged.
- All tests pass and the test count does not fall below the baseline.
- Type checking and the production build pass.
- Persistence keys, schemas, and behavior are unchanged.
- AI requests, fallbacks, errors, and tracking behavior are unchanged.
- Priority, Campaign, fulfillment, archive, and restore outcomes are unchanged.
- `App.tsx` primarily coordinates state, derived data, business operations, and modules.
- Feature components have understandable typed interfaces and no circular imports.
- No new runtime or state-management dependency is introduced.

A likely Stage 1 result is an `App.tsx` between approximately 2,500 and 3,000 lines. This is an observation target, not an acceptance requirement.

## Stop Conditions

Stop the current PR and revisit the design if:

- Extraction requires a business-logic or persistence change.
- A `localStorage` key, schema, migration, or write order must change.
- Integration tests require broad rewrites.
- A component duplicates priority or Campaign logic.
- A page contract becomes an unstructured collection of unrelated props.
- A cross-feature circular dependency appears.
- Tests are removed, skipped, or reduced to make the refactor pass.
- UI output or action order changes.
- An unrelated bug fix becomes necessary; handle it in a separate issue and PR.

## Stage 2 Hook Admission Rules

A business hook may be extracted only when it:

- Has one clear responsibility.
- Has stable, typed inputs and outputs.
- Does not depend on JSX.
- Can be tested independently.
- Does not rely on hidden effect-based synchronization.
- Does not create a second source of truth.
- Reduces coupling without duplicating persistence or domain rules.

Only one business hook is extracted per PR. If Stage 1 sufficiently improves safety and maintainability, Stage 2 may be postponed indefinitely.

## Known Risks and Mitigations

- **Large prop contracts:** group props by responsibility and reject catch-all application state.
- **Callback wiring mistakes:** preserve integration tests and add focused callback tests.
- **Behavior changes hidden as cleanup:** prohibit unrelated cleanup and review functional diffs separately.
- **Stale static-analysis results:** verify JSX references in source and tests before treating code as unused.
- **Merge conflicts:** start each PR from the latest `main` and merge sequentially.
- **Local Node.js differences:** use the Node.js 22 CI result as the required verification environment.
