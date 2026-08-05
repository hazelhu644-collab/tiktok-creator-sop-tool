# Dashboard Page Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the complete “今日工作台” page and follow-up workbench JSX from `src/App.tsx` into a typed controlled `DashboardPage` without changing UI, priority rules, Campaign behavior, queue processing, messaging, persistence, or user-visible behavior.

**Architecture:** `App.tsx` remains the only owner of creator/Campaign state, derived task queues, priority/status calculations, filtering, API calls, persistence, scrolling decisions, queue progression, tracking mutations, and toast decisions. `DashboardPage` receives presentation-ready Campaign cards, metric cards, queue rows, current-creator details, controlled UI state, callback actions, and optional `MessageComposerProps`; it renders the existing page and composes the already-extracted `MessageComposer`.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, jsdom, Node.js 22.

## Global Constraints

- Start from `48471c8` or a newer latest `main` containing merged PR #65 and the approved component-split design; do not stack on an older extraction branch.
- Preserve page layout, DOM order, classes, labels, helper copy, `aria-*` attributes, test ids, conditional rendering, disabled states, and product behavior exactly.
- Preserve the Highest/High/Medium/Low ordering, reason text, action text, handled-today rules, historical drill-down rules, Campaign matching, video counts, archive visibility, duplicate warnings, and current-creator selection exactly.
- Preserve every creator/Campaign `localStorage` key, schema, migration, persistence timing, and write order.
- Keep `analyzeCreators`, `compareTasks`, `inferStatus`, `priorityLabel`, `queueStatusLabel`, `matchesWorkbenchFilter`, filtering, `campaignStats`, video-progress calculations, duplicate checks, requirement selection, and all other business/derived-data calculations in `App.tsx`.
- Keep queue selection/progression, scroll scheduling, state transitions, API calls, local message generation, clipboard effects, tracking/history mutations, persistence calls, and toast decisions in `App.tsx`.
- Keep the global store/Campaign selector and application shell in `App.tsx`; this PR extracts only `renderDashboard()` and its dashboard-only Campaign overview markup.
- Reuse the existing `MessageComposer` by passing `MessageComposerProps`; do not duplicate or move its API/state/business ownership.
- Do not introduce Context, Redux, another state library, a hook extraction, a new dependency, effect-based prop mirroring, or a second source of truth.
- Do not remove functions based on static unused-code output; the graph was stale and misclassified JSX callbacks as dead code.
- Do not remove, skip, snapshot-replace, or broadly rewrite existing integration tests. The full suite must contain at least 200 tests before adding focused component tests.
- Do not combine bug fixes, copy changes, formatting sweeps, dependency updates, vulnerability remediation, or unused-code cleanup with this extraction.
- Run all verification with Node.js 22.
- Create and wire `DashboardPage`, then remove the old dashboard JSX before the first reviewable commit; no committed intermediate may contain duplicate dashboard implementations.

---

## File Map

- Create `src/features/dashboard/dashboardTypes.ts`: dashboard-only view models and the controlled `{data, uiState, actions}` contract.
- Create `src/features/dashboard/DashboardPage.tsx`: presentational Dashboard, Campaign overview, workbench queue, current-creator panel, and `MessageComposer` composition.
- Create `src/features/dashboard/DashboardPage.test.tsx`: focused rendering, controlled callback, queue-state, warning/detail, and composer-composition tests.
- Modify `src/App.tsx`: build presentation-ready dashboard view models, retain all business operations, render `DashboardPage`, and remove only the old dashboard JSX/helpers that become dashboard presentation.
- Preserve `src/App.test.tsx`: retain the existing Dashboard, queue, Highest priority, Campaign drill-down, messaging, progress, tracking, and persistence safety nets unchanged.

## Contract Locked for This PR

Create `src/features/dashboard/dashboardTypes.ts` with exactly this contract. Do not add raw application state, persistence objects, API payloads, domain helper functions, catch-all callbacks, or `unknown`.

```ts
import type { RefObject } from "react";
import type { Channel } from "../../types";
import type { MessageComposerProps } from "../messaging/messageComposerTypes";

export type WorkbenchFilterKey =
  | "follow_up_today"
  | "processed_today"
  | "delivered_waiting_video"
  | "published_video"
  | "posted_this_week"
  | "completed"
  | "failed"
  | "sample_shipped";

export type DashboardUrgency = "All" | "Highest" | "High" | "Medium" | "Low";

export type DashboardCampaignCardView = {
  value: string;
  label: string;
  ariaLabel: string;
  creatorCount: number;
  activeCount: number;
  todayFollowUp: number;
  highPriority: number;
  inTransit: number;
  deliveredPending: number;
  postedVideos: number;
  completed: number;
  failed: number;
};

export type DashboardMetricCardView = {
  label: string;
  value: number;
  filterKey: WorkbenchFilterKey;
};

export type DashboardQueueItemView = {
  id: string;
  creatorHandle: string;
  priorityLabel: string;
  statusLabel: string;
  multiSample: boolean;
  subLine: string;
};

export type DashboardDetailEntry = {
  label: string;
  value: string;
};

export type DashboardCreatorView = {
  id: string;
  displayName: string;
  storeName: string;
  productName: string;
  statusLabel: string;
  priorityLabel: string;
  triggerReason: string;
  suggestedAction: string;
  trackingStatus: string;
  notes: string;
  crossStoreCreator: boolean;
  otherActiveSampleCount: number;
  filmingRequirements: DashboardDetailEntry[];
  moreInfo: DashboardDetailEntry[];
};

export type DashboardData = {
  campaignCards: DashboardCampaignCardView[];
  metricCards: DashboardMetricCardView[];
  selectedCampaignName: string;
  workbenchFilterLabel: string;
  highestPendingCount: number;
  queueItems: DashboardQueueItemView[];
  selectedCreator: DashboardCreatorView | null;
  hasNextTask: boolean;
  channelOptions: Channel[];
  messageComposerProps: MessageComposerProps | null;
};

export type DashboardUiState = {
  onlyCurrentCreator: boolean;
  queueExpanded: boolean;
  followupSearch: string;
  creatorSearchStatus: string;
  showArchivedCollaborations: boolean;
  urgency: DashboardUrgency;
  showProcessedToday: boolean;
  selectedCreatorId: string;
  channel: Channel;
  historicalReadOnly: boolean;
  queueRef: RefObject<HTMLElement | null>;
  currentCreatorRef: RefObject<HTMLDivElement | null>;
};

export type DashboardActions = {
  openCreatorDatabase: () => void;
  selectCampaignCard: (value: string) => void;
  selectMetricCard: (card: DashboardMetricCardView) => void;
  toggleOnlyCurrentCreator: () => void;
  clearWorkbenchFilter: () => void;
  toggleQueue: () => void;
  setFollowupSearch: (value: string) => void;
  locateCreator: () => void;
  setShowArchivedCollaborations: (value: boolean) => void;
  setUrgency: (value: DashboardUrgency) => void;
  setShowProcessedToday: (value: boolean) => void;
  selectCreator: (creatorId: string) => void;
  setChannel: (channel: Channel) => void;
  generateMessage: () => void;
  processNextCreator: () => void;
  showOtherSamples: () => void;
  showMultiSampleReminder: () => void;
};

export type DashboardPageProps = {
  data: DashboardData;
  uiState: DashboardUiState;
  actions: DashboardActions;
};
```

### Task 1: Build and Wire the Controlled Dashboard Page

**Files:**

- Create: `src/features/dashboard/dashboardTypes.ts`
- Create: `src/features/dashboard/DashboardPage.test.tsx`
- Create: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/App.tsx:1-120`
- Modify: `src/App.tsx:880-1050`
- Modify: `src/App.tsx:1420-1480`
- Modify: `src/App.tsx:2677-3239`

**Interfaces:**

- Consumes: `Channel`, `MessageComposerProps`, the existing App-owned dashboard derivations/handlers, and the exact contract above.
- Produces: `DashboardPage(props: DashboardPageProps): JSX.Element` and a single App render path that preserves all business ownership.

- [ ] **Step 1: Create the exact contract file**

Create `src/features/dashboard/dashboardTypes.ts` with the complete code in “Contract Locked for This PR.” Move the existing `WorkbenchFilterKey` alias from `App.tsx` into this file and import it back into App. Do not rename its string literals.

- [ ] **Step 2: Write the focused fixture and first failing render test**

Create `src/features/dashboard/DashboardPage.test.tsx` with a `createProps()` fixture containing:

```tsx
const base: DashboardPageProps = {
  data: {
    campaignCards: [
      {
        value: "store-1::pet-brush",
        label: "Pet Brush",
        ariaLabel: "Pet Brush2 位达人",
        creatorCount: 2,
        activeCount: 2,
        todayFollowUp: 1,
        highPriority: 1,
        inTransit: 0,
        deliveredPending: 1,
        postedVideos: 1,
        completed: 0,
        failed: 0,
      },
    ],
    metricCards: [
      {
        label: "今日待跟进达人数量",
        value: 1,
        filterKey: "follow_up_today",
      },
    ],
    selectedCampaignName: "Pet Brush",
    workbenchFilterLabel: "",
    highestPendingCount: 1,
    queueItems: [
      {
        id: "creator-1",
        creatorHandle: "@alpha_creator",
        priorityLabel: "最高",
        statusLabel: "待跟进",
        multiSample: false,
        subLine: "Pet Brush · 已签收",
      },
    ],
    selectedCreator: {
      id: "creator-1",
      displayName: "alpha_creator",
      storeName: "TerraPaw",
      productName: "Pet Brush",
      statusLabel: "已签收",
      priorityLabel: "最高",
      triggerReason: "产品已送达 2 天，视频进度仍为 0/2。",
      suggestedAction: "发送拍摄跟进。",
      trackingStatus: "待跟进",
      notes: "Creator prefers weekends",
      crossStoreCreator: false,
      otherActiveSampleCount: 0,
      filmingRequirements: [{ label: "产品名称", value: "Pet Brush" }],
      moreInfo: [{ label: "联系渠道", value: "TikTok DM" }],
    },
    hasNextTask: true,
    channelOptions: ["TikTok DM", "Email"],
    messageComposerProps: null,
  },
  uiState: {
    onlyCurrentCreator: false,
    queueExpanded: true,
    followupSearch: "",
    creatorSearchStatus: "",
    showArchivedCollaborations: false,
    urgency: "All",
    showProcessedToday: false,
    selectedCreatorId: "creator-1",
    channel: "TikTok DM",
    historicalReadOnly: false,
    queueRef: createRef<HTMLElement>(),
    currentCreatorRef: createRef<HTMLDivElement>(),
  },
  actions: {
    openCreatorDatabase: vi.fn(),
    selectCampaignCard: vi.fn(),
    selectMetricCard: vi.fn(),
    toggleOnlyCurrentCreator: vi.fn(),
    clearWorkbenchFilter: vi.fn(),
    toggleQueue: vi.fn(),
    setFollowupSearch: vi.fn(),
    locateCreator: vi.fn(),
    setShowArchivedCollaborations: vi.fn(),
    setUrgency: vi.fn(),
    setShowProcessedToday: vi.fn(),
    selectCreator: vi.fn(),
    setChannel: vi.fn(),
    generateMessage: vi.fn(),
    processNextCreator: vi.fn(),
    showOtherSamples: vi.fn(),
    showMultiSampleReminder: vi.fn(),
  },
};
```

Add the first test:

```tsx
it("renders the existing Dashboard overview, queue, and current creator", () => {
  render(<DashboardPage {...createProps()} />);

  expect(
    screen.getByRole("heading", { name: "今日工作台" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "产品项目概览" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Pet Brush2 位达人" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /今日待跟进达人数量1Pet Brush/ }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("creator-queue")).toHaveTextContent(
    "@alpha_creator",
  );
  expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
    "Creator prefers weekends",
  );
});
```

- [ ] **Step 3: Run the focused test and confirm RED**

```bash
npm test -- src/features/dashboard/DashboardPage.test.tsx
```

Expected: FAIL because `./DashboardPage` does not exist.

- [ ] **Step 4: Implement the presentational component by moving existing JSX**

Create `src/features/dashboard/DashboardPage.tsx`. It must:

1. Import `MessageComposer` and the `DashboardPageProps`/`Channel` types only.
2. Move the full existing `renderDashboard()` markup, including page header, dashboard-only Campaign overview, metric cards, workbench controls, queue, current-creator panel, warnings, details blocks, empty states, and composer placement.
3. Read only from `data` and `uiState`; invoke only `actions` callbacks.
4. Attach `uiState.queueRef` to the existing `workbench-panel` section and `uiState.currentCreatorRef` to the existing `current-creator-panel` div.
5. Render `<MessageComposer {...data.messageComposerProps} />` only when `messageComposerProps` is non-null.
6. Preserve the existing Enter-key behavior by calling `actions.locateCreator()` only when `event.key === "Enter"`.
7. Call neither domain helpers, persistence helpers, message generation, `fetch`, clipboard functions, React state, nor effects.

Locked mapping:

```text
renderCampaignOverview campaign loop -> data.campaignCards
dashboardCards -> data.metricCards
selectedCampaignName -> data.selectedCampaignName
workbenchFilter?.label -> data.workbenchFilterLabel
highestPendingCount -> data.highestPendingCount
filteredTasks queue loop -> data.queueItems
selectedTask/current derived fields -> data.selectedCreator
nextTask -> data.hasNextTask
CHANNELS -> data.channelOptions
onlyCurrentCreator -> uiState.onlyCurrentCreator
isQueueExpanded -> uiState.queueExpanded
followupSearch -> uiState.followupSearch
creatorSearchStatus -> uiState.creatorSearchStatus
showArchivedCollaborations -> uiState.showArchivedCollaborations
followupUrgency -> uiState.urgency
showProcessedToday -> uiState.showProcessedToday
selectedTask?.id -> uiState.selectedCreatorId
channel -> uiState.channel
isHistoricalReadOnly -> uiState.historicalReadOnly
queueRef/currentCreatorRef -> uiState refs
```

- [ ] **Step 5: Run the first component test and confirm GREEN**

```bash
npm test -- src/features/dashboard/DashboardPage.test.tsx
```

Expected: 1 test passes.

- [ ] **Step 6: Add the second and third tests for controlled callbacks and queue states**

Add tests that assert:

```tsx
await user.click(screen.getByRole("button", { name: "Pet Brush2 位达人" }));
expect(props.actions.selectCampaignCard).toHaveBeenCalledWith(
  "store-1::pet-brush",
);

await user.click(screen.getByRole("button", { name: /今日待跟进达人数量/ }));
expect(props.actions.selectMetricCard).toHaveBeenCalledWith(
  props.data.metricCards[0],
);

fireEvent.change(screen.getByLabelText("搜索队列"), {
  target: { value: "alpha" },
});
expect(props.actions.setFollowupSearch).toHaveBeenCalledWith("alpha");
fireEvent.keyDown(screen.getByLabelText("搜索队列"), { key: "Enter" });
expect(props.actions.locateCreator).toHaveBeenCalledTimes(1);

await user.selectOptions(screen.getByLabelText("紧急程度"), "Highest");
expect(props.actions.setUrgency).toHaveBeenCalledWith("Highest");
await user.selectOptions(screen.getByLabelText("选择达人"), "creator-1");
expect(props.actions.selectCreator).toHaveBeenCalledWith("creator-1");
```

The second test covers the callback assertions above. The third test rerenders with `queueExpanded: false`, `onlyCurrentCreator: false` and asserts “达人队列已收起。”; it then rerenders with `selectedCreator: null`, `queueItems: []`, and a non-empty `workbenchFilterLabel` and asserts both existing empty-state messages.

- [ ] **Step 7: Add the fourth and fifth tests for current-creator details and composer composition**

The fourth test rerenders with `crossStoreCreator: true`, `otherActiveSampleCount: 2`, and asserts the two warning headings, filming requirements, and more-info values. It clicks “查看其他样品记录”, “生成多样品合并提醒”, and “处理下一个达人” and asserts the exact callbacks.

The fifth test creates a valid minimal `MessageComposerProps` fixture using the existing messaging contract, passes it as `data.messageComposerProps`, and asserts the “达人回复处理” heading renders. It rerenders with `historicalReadOnly: true` and asserts the exact read-only helper copy remains visible.

- [ ] **Step 8: Run focused component tests**

```bash
npm test -- src/features/dashboard/DashboardPage.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 9: Build presentation-ready view models in App**

Keep `campaignStats()` and all domain calculations in App. Build:

```ts
const dashboardCampaignCards: DashboardCampaignCardView[] =
  storeFilteredCampaigns.map((campaign) => {
    const stats = campaignStats(campaign);
    const label = campaignLabel(campaign, showStoreLabels);
    return {
      value: campaignOptionValue(campaign),
      label,
      ariaLabel: `${label}${stats.creatorCount} 位达人`,
      creatorCount: stats.creatorCount,
      activeCount: stats.activeCount,
      todayFollowUp: stats.todayFollowUp,
      highPriority: stats.highPriority,
      inTransit: stats.inTransit,
      deliveredPending: stats.deliveredPending,
      postedVideos: stats.postedVideos,
      completed: stats.completed,
      failed: stats.failed,
    };
  });
```

Build `dashboardQueueItems` and `dashboardSelectedCreator` in App using the existing helpers and exact display fallbacks. `moreInfo` must retain the current order: 联系渠道, 最近联系日期, 样品状态, 样品到货日期, 视频进度, 首条视频发布时间, 最近回复日期, 主页链接. `filmingRequirements` must use the existing `campaignRequirementEntries(selectedTaskCampaignRequirements(selectedTask))` result unchanged.

- [ ] **Step 10: Replace `renderDashboard()` with the controlled page**

Import `DashboardPage` and the dashboard view types. Remove the direct `MessageComposer` import from App. Replace the old dashboard JSX with one `DashboardPage` render and exact callback adapters. Important adapters:

```tsx
selectMetricCard: handleDashboardCardClick,
clearWorkbenchFilter: () => {
  setWorkbenchFilter(null);
  setSelectedCreatorId("");
},
showOtherSamples: () => {
  if (!selectedTask) return;
  setFollowupSearch(displayName(selectedTask));
  setOnlyCurrentCreator(false);
  setIsQueueExpanded(true);
},
showMultiSampleReminder: () =>
  setToast({
    tone: "success",
    text: "生成多样品合并提醒：请在一条消息中列出多个产品，并分别确认每个样品的到货、拍摄和发布时间。",
  }),
```

Construct `messageComposerProps` in App with the same values/callbacks currently passed to `MessageComposer`. Return `null` under the exact old condition `!(shouldShowReplyBlock && selectedTask)`.

Delete only the obsolete `renderCampaignOverview()` JSX helper and old inline dashboard JSX. Keep `campaignStats()`, `handleLocateCreator()`, every handler, every derivation, and the global `renderCampaignSelector()` in App.

- [ ] **Step 11: Run focused integration safety nets**

```bash
npm test -- src/App.test.tsx -t "shows the eight Dashboard metric cards|shows and filters Highest work|keeps overview card clicks on 今日工作台|uses product-first workflow|selecting a creator collapses|clicking an overview card stays on Today Workbench|shows an actionable empty state"
npm test -- src/App.test.tsx -t "keeps multi-sample creator rows separate|shows a local recommended message|updates video progress from the workbench|processes local-message tracking actions|uses compact creator selector labels|shows short priority reason|records a creator reply from Follow-up Center"
```

Expected: all selected tests pass with no existing test edits.

- [ ] **Step 12: Run static checks and the full suite**

```bash
npx tsc --noEmit --pretty false
npm test
npm run build
git diff --check
```

Expected: at least 205 tests pass after adding five focused tests; typecheck and build pass; existing jsdom `Window.confirm()` notices may remain.

- [ ] **Step 13: Verify the ownership boundary**

```bash
rg -n "analyzeCreators|compareTasks|inferStatus|priorityLabel|queueStatusLabel|matchesWorkbenchFilter|campaignStats|localStorage|saveCreatorRows|fetch|generateMessage|setRows|setToast" src/features/dashboard
rg -n "今日工作台|today workbench|creator-queue|current-creator-panel|DashboardPage" src/App.tsx src/features/dashboard
git diff -- src/App.test.tsx package.json package-lock.json
```

Expected: no business/API/persistence ownership in `src/features/dashboard`; one Dashboard implementation/render path; no existing integration-test or dependency changes.

- [ ] **Step 14: Commit the complete extraction**

```bash
git add src/App.tsx src/features/dashboard/dashboardTypes.ts src/features/dashboard/DashboardPage.tsx src/features/dashboard/DashboardPage.test.tsx docs/superpowers/plans/2026-08-05-dashboard-page-extraction.md
git commit -m "Extract controlled dashboard page"
```

### Task 2: Verify Behavior Preservation and Prepare the Pull Request

**Files:**

- Verify: `src/App.tsx`
- Verify: `src/features/dashboard/dashboardTypes.ts`
- Verify: `src/features/dashboard/DashboardPage.tsx`
- Verify: `src/features/dashboard/DashboardPage.test.tsx`
- Preserve: `src/App.test.tsx`, `src/sopRules.ts`, `src/messageGenerator.ts`, Campaign/creator persistence modules, and dependencies.

**Interfaces:**

- Consumes: the reviewed controlled Dashboard from Task 1.
- Produces: an independently revertible PR containing only the Dashboard presentation extraction and its plan/tests.

- [ ] **Step 1: Audit the focused diff**

```bash
git diff origin/main...HEAD --stat
git diff --check origin/main...HEAD
git diff origin/main...HEAD -- src/App.tsx src/features/dashboard docs/superpowers/plans/2026-08-05-dashboard-page-extraction.md
```

Expected: only the plan, App extraction, and three dashboard feature files. No changes to domain modules, dependencies, storage keys, or existing integration tests.

- [ ] **Step 2: Confirm one render path and retained ownership**

```bash
rg -n "今日工作台|creator-queue|current-creator-panel|DashboardPage" src/App.tsx src/features/dashboard
rg -n "analyzeCreators|inferStatus|campaignStats|saveCreatorRows|localStorage|fetch|generateMessage|setRows|setToast" src/features/dashboard
```

Expected: one page implementation/render and no business/API/persistence ownership in the component.

- [ ] **Step 3: Run final Node.js 22 verification**

```bash
npm ci
npm test
npx tsc --noEmit --pretty false
npm run build
```

Expected: lockfile unchanged, at least 205 tests pass, typecheck passes, and production build passes.

- [ ] **Step 4: Manually verify invariants**

Confirm in the diff/tests:

- The global store/Campaign selector remains in App and retains its exact reset order.
- Dashboard Campaign cards and eight metric cards retain labels, counts, order, aria labels, and click behavior.
- Highest priority count/filter/order/reason/action behavior is unchanged.
- Queue search, Enter locate, archive visibility, urgency, processed-today, creator selection, channel selection, expansion, and current-only controls are unchanged.
- Queue/current/message refs remain attached to the same DOM elements.
- Historical drill-down stays read-only and uses the same task source.
- Current-creator duplicate/multi-sample warnings, filming requirements, details order, and empty states are unchanged.
- `MessageComposer` receives the same data/UI/actions and retains all existing App-owned business callbacks.
- No priority, Campaign, storage, API, fallback, progress, tracking, history, archive, or persistence code changed.

- [ ] **Step 5: Publish a separate PR without merging**

Push the clean branch and create:

```text
Title: Extract controlled Dashboard page

Summary:
- move the Dashboard overview, Campaign cards, workbench queue, and current-creator UI into a typed controlled page
- keep priority calculations, filtering, queue processing, persistence, messaging, and tracking operations in App
- add focused Dashboard component tests while preserving the existing integration safety net

Behavior change: None
```

Do not start PR 5 smaller-pages/App-shell extraction until this PR is reviewed, CI passes, and it is merged into `main`.
