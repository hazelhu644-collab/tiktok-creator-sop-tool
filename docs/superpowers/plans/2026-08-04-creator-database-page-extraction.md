# Creator Database Page Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the controlled Creator Database page from `src/App.tsx` without changing UI, persistence, domain rules, or user-visible behavior.

**Architecture:** `App.tsx` remains the only owner of creator records, filters, selection, persistence, duplicate detection, bulk operations, archive/restore behavior, and import/export actions. A new `CreatorDatabasePage` receives a typed `{data, uiState, actions}` contract and renders the existing page markup. Existing App integration tests remain the behavioral safety net; focused component tests verify the new prop contract and callback wiring.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, jsdom, Node.js 22.

## Global Constraints

- GitHub Actions CI must be active on `main` before implementation begins.
- Start the implementation branch from the latest `main`; do not stack it on the design or CI branch.
- Preserve UI layout, labels, interaction order, and product behavior exactly.
- Preserve all `localStorage` keys, schemas, migration behavior, persistence timing, and write order.
- Preserve creator priority, Campaign matching, video fulfillment, archive, restore, duplicate detection, and outreach behavior.
- Preserve DeepSeek/OpenAI behavior even though this PR does not intentionally touch it.
- Do not introduce Context, Redux, another state library, or a new dependency.
- Do not remove or skip existing tests; the full suite must contain at least 176 tests.
- Do not combine bug fixes, copy changes, formatting sweeps, or unused-code cleanup with this extraction.
- Run verification with Node.js 22. Local Node.js 26 results are not accepted as the required CI signal.
- Create the controlled component, wire it into `App.tsx`, and remove the old inline JSX before the first task review or commit. No committed intermediate state may contain duplicate page implementations or an unused extracted page.

---

## File Map

- Create `src/features/creators/creatorDatabaseTypes.ts`: feature-local controlled-page contract and row view type.
- Create `src/features/creators/CreatorDatabasePage.tsx`: presentational Creator Database page, including header, import/export card, filters, bulk controls, table, empty state, and archive controls.
- Create `src/features/creators/CreatorDatabasePage.test.tsx`: focused rendering and callback-wiring tests.
- Modify `src/App.tsx`: build the view model, adapt existing handlers to the page contract, render the new component, and remove the old inline JSX only after integration tests pass.
- Preserve `src/App.test.tsx`: keep existing integration tests unchanged unless an import-only mechanical change is strictly required.

## Contract Locked for This PR

Create `src/features/creators/creatorDatabaseTypes.ts` with these interfaces. Do not add a catch-all `appState`, `setState`, or `unknown` escape hatch.

```ts
import type { EditableCreatorField } from "../../creatorData";
import type { CreatorRow } from "../../types";

export type CreatorStatusOption = {
  value: string;
  label: string;
};

export type CreatorDatabaseRowView = {
  row: CreatorRow;
  displayName: string;
  archived: boolean;
  canRestore: boolean;
  duplicate: {
    possibleDuplicate: boolean;
    multiSample: boolean;
    crossStoreCreator: boolean;
  };
};

export type PendingDuplicateView = {
  draft: CreatorRow;
  existing: CreatorRow;
} | null;

export type CreatorDatabaseData = {
  rows: CreatorDatabaseRowView[];
  statusOptions: CreatorStatusOption[];
  productTotalCount: number;
  archivedProductCount: number;
  archivedSearchMatchCount: number;
  defaultStoreName: string;
};

export type CreatorDatabaseUiState = {
  search: string;
  statusFilter: string;
  creatorTypeFilter: string;
  followerFilter: string;
  avgViewsFilter: string;
  gmvFilter: string;
  selectedIds: string[];
  showArchivedCollaborations: boolean;
  bulkStatus: string;
  fileName: string;
  importSummary: string;
  error: string;
  pendingDuplicate: PendingDuplicateView;
};

export type CreatorDatabaseActions = {
  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setCreatorTypeFilter: (value: string) => void;
  setFollowerFilter: (value: string) => void;
  setAvgViewsFilter: (value: string) => void;
  setGmvFilter: (value: string) => void;
  setShowArchivedCollaborations: (value: boolean) => void;
  setBulkStatus: (value: string) => void;
  toggleSelected: (rowId: string) => void;
  toggleSelectAll: (checked: boolean) => void;
  updateRow: (
    rowId: string,
    field: EditableCreatorField,
    value: string,
  ) => void;
  bulkCopyOutreach: () => void;
  bulkUpdateStatus: () => void;
  copyOutreach: (rowId: string) => void;
  archiveCreator: (rowId: string) => void;
  restoreCreator: (rowId: string) => void;
  importFile: (file: File | undefined) => void | Promise<void>;
  exportCsv: () => void;
  addCreator: () => void;
  continueDuplicate: () => void;
  copyDuplicateBase: () => void;
  cancelDuplicate: () => void;
};

export type CreatorDatabasePageProps = {
  data: CreatorDatabaseData;
  uiState: CreatorDatabaseUiState;
  actions: CreatorDatabaseActions;
};
```

---

### Task 1: Build and Wire the Controlled Creator Database Page

**Files:**

- Create: `src/features/creators/creatorDatabaseTypes.ts`
- Create: `src/features/creators/CreatorDatabasePage.test.tsx`
- Create: `src/features/creators/CreatorDatabasePage.tsx`

**Interfaces:**

- Consumes: `CreatorRow` from `src/types.ts` and `EditableCreatorField` from `src/creatorData.ts`.
- Produces: `CreatorDatabasePage(props: CreatorDatabasePageProps): JSX.Element` and the exact contract in the preceding section.

- [ ] **Step 1: Create the contract file exactly as specified**

Create `src/features/creators/creatorDatabaseTypes.ts` using the complete code in “Contract Locked for This PR.” Do not import application state setters or helpers from `App.tsx`.

- [ ] **Step 2: Write the focused test fixture and first failing rendering test**

Create `src/features/creators/CreatorDatabasePage.test.tsx` with a complete controlled fixture:

```tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreatorRow } from "../../types";
import { CreatorDatabasePage } from "./CreatorDatabasePage";
import type { CreatorDatabasePageProps } from "./creatorDatabaseTypes";

function creatorRow(patch: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: "creator-1",
    username: "alpha_creator",
    profileLink: "https://www.tiktok.com/@alpha_creator",
    contactMethod: "TikTok DM",
    storeName: "TerraPaw",
    product: "Pet Brush",
    currentStatus: "Invited",
    sampleShippingStatus: "",
    sampleDeliveredDate: "",
    videoProgress: "0/2",
    firstVideoPostedDate: "",
    lastContactDate: "",
    lastFollowUpCount: 0,
    notes: "",
    ...patch,
  };
}

function createProps(
  overrides: Partial<CreatorDatabasePageProps> = {},
): CreatorDatabasePageProps {
  const row = creatorRow();
  const base: CreatorDatabasePageProps = {
    data: {
      rows: [
        {
          row,
          displayName: "alpha_creator",
          archived: false,
          canRestore: false,
          duplicate: {
            possibleDuplicate: false,
            multiSample: false,
            crossStoreCreator: false,
          },
        },
      ],
      statusOptions: [
        { value: "Invited", label: "已邀约" },
        { value: "Sample Approved", label: "样品已通过" },
      ],
      productTotalCount: 1,
      archivedProductCount: 0,
      archivedSearchMatchCount: 0,
      defaultStoreName: "默认店铺",
    },
    uiState: {
      search: "",
      statusFilter: "All",
      creatorTypeFilter: "All",
      followerFilter: "All",
      avgViewsFilter: "All",
      gmvFilter: "All",
      selectedIds: [],
      showArchivedCollaborations: false,
      bulkStatus: "Invited",
      fileName: "",
      importSummary: "",
      error: "",
      pendingDuplicate: null,
    },
    actions: {
      setSearch: vi.fn(),
      setStatusFilter: vi.fn(),
      setCreatorTypeFilter: vi.fn(),
      setFollowerFilter: vi.fn(),
      setAvgViewsFilter: vi.fn(),
      setGmvFilter: vi.fn(),
      setShowArchivedCollaborations: vi.fn(),
      setBulkStatus: vi.fn(),
      toggleSelected: vi.fn(),
      toggleSelectAll: vi.fn(),
      updateRow: vi.fn(),
      bulkCopyOutreach: vi.fn(),
      bulkUpdateStatus: vi.fn(),
      copyOutreach: vi.fn(),
      archiveCreator: vi.fn(),
      restoreCreator: vi.fn(),
      importFile: vi.fn(),
      exportCsv: vi.fn(),
      addCreator: vi.fn(),
      continueDuplicate: vi.fn(),
      copyDuplicateBase: vi.fn(),
      cancelDuplicate: vi.fn(),
    },
  };

  return {
    ...base,
    ...overrides,
    data: { ...base.data, ...overrides.data },
    uiState: { ...base.uiState, ...overrides.uiState },
    actions: { ...base.actions, ...overrides.actions },
  };
}

describe("CreatorDatabasePage", () => {
  it("renders the existing database columns and controlled creator row", () => {
    render(<CreatorDatabasePage {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "达人数据库" }),
    ).toBeInTheDocument();
    const headers = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headers.slice(1, 18)).toEqual([
      "达人账号",
      "主页链接",
      "联系渠道",
      "店铺 / 品牌",
      "产品",
      "合作状态",
      "样品到货日期",
      "视频进度",
      "首条视频发布日期",
      "最近联系日期",
      "跟进次数",
      "跟进状态",
      "最近沟通动作",
      "最近沟通渠道",
      "下次跟进日期",
      "达人回复",
      "达人备注",
    ]);
    expect(screen.getByDisplayValue("alpha_creator")).toBeInTheDocument();
    expect(screen.queryByText("样品物流状态")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the component is missing**

Run:

```bash
npm test -- src/features/creators/CreatorDatabasePage.test.tsx
```

Expected: FAIL because `./CreatorDatabasePage` does not yet export the component.

- [ ] **Step 4: Implement the minimal controlled component with the existing markup**

Create `src/features/creators/CreatorDatabasePage.tsx` with this exact import, signature, and UI-only selection calculation:

```tsx
import type { CreatorDatabasePageProps } from "./creatorDatabaseTypes";

export function CreatorDatabasePage({
  data,
  uiState,
  actions,
}: CreatorDatabasePageProps) {
  const allSelected =
    data.rows.length > 0 &&
    data.rows.every((entry) => uiState.selectedIds.includes(entry.row.id));
```

After that prefix, return one fragment containing these existing source blocks verbatim before applying the controlled substitutions below:

1. The static header currently produced by `renderPageHeader("达人数据库", ...)` at `src/App.tsx:3579`.
2. The full `renderImportCard` JSX currently at `src/App.tsx:2691-2766`.
3. The full table panel currently at `src/App.tsx:3583-4050`.

Close the fragment, the return statement, and the component function normally. Preserve every class name, label, option value, column, input hint, conditional, and button.

Apply these exact substitutions while moving `renderImportCard` and `renderCreatorDatabase` markup:

| Existing closure                          | Controlled replacement                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `fileName`                                | `uiState.fileName`                                    |
| `importSummary`                           | `uiState.importSummary`                               |
| `error`                                   | `uiState.error`                                       |
| `pendingDuplicateAdd`                     | `uiState.pendingDuplicate`                            |
| `handleFile(file)`                        | `actions.importFile(file)`                            |
| `downloadCreatorRowsCsv(rows)`            | `actions.exportCsv()`                                 |
| `handleAddCreator()`                      | `actions.addCreator()`                                |
| duplicate continuation                    | `actions.continueDuplicate()`                         |
| duplicate base copy                       | `actions.copyDuplicateBase()`                         |
| duplicate cancellation                    | `actions.cancelDuplicate()`                           |
| `search` / `setSearch`                    | `uiState.search` / `actions.setSearch(value)`         |
| filter state setters                      | matching `uiState` field / `actions.set...` callback  |
| `creatorStatuses` and `displayStatus`     | `data.statusOptions`                                  |
| `showArchivedCollaborations`              | `uiState.showArchivedCollaborations`                  |
| `archivedProductCount`                    | `data.archivedProductCount`                           |
| `productTotalCount`                       | `data.productTotalCount`                              |
| `filteredRows`                            | `data.rows`                                           |
| `archivedSearchMatches.length`            | `data.archivedSearchMatchCount`                       |
| `selectedIds`                             | `uiState.selectedIds`                                 |
| `bulkStatus` / `setBulkStatus`            | `uiState.bulkStatus` / `actions.setBulkStatus(value)` |
| `toggleSelectAll(event)`                  | `actions.toggleSelectAll(event.target.checked)`       |
| `toggleSelected(id)`                      | `actions.toggleSelected(id)`                          |
| `updateRow(id, field, value)`             | `actions.updateRow(id, field, value)`                 |
| `handleBulkCopyOutreach()`                | `actions.bulkCopyOutreach()`                          |
| `handleBulkStatusUpdate()`                | `actions.bulkUpdateStatus()`                          |
| `displayName(entry.row)`                  | `entry.displayName`                                   |
| `isArchivedCollaboration(entry.row)`      | `entry.archived`                                      |
| `getDuplicateCheck(...)`                  | `entry.duplicate`                                     |
| `DEFAULT_STORE_NAME`                      | `data.defaultStoreName`                               |
| `copyText(buildOutreachForRow(row), ...)` | `actions.copyOutreach(row.id)`                        |
| `archiveCreator(id)`                      | `actions.archiveCreator(id)`                          |
| `restoreCreator(id)`                      | `actions.restoreCreator(id)`                          |
| manual restore eligibility                | `entry.canRestore`                                    |

Do not paraphrase Chinese copy or normalize formatting while moving the markup.

- [ ] **Step 5: Run the focused rendering test**

Run:

```bash
npm test -- src/features/creators/CreatorDatabasePage.test.tsx
```

Expected: PASS with 1 test.

- [ ] **Step 6: Add callback-wiring and archive-state tests**

Append these tests inside the existing `describe` block:

```tsx
it("forwards controlled search, row editing, selection, and bulk actions", async () => {
  const user = userEvent.setup();
  const props = createProps();
  render(<CreatorDatabasePage {...props} />);

  fireEvent.change(screen.getByLabelText("搜索"), {
    target: { value: "alpha" },
  });
  expect(props.actions.setSearch).toHaveBeenCalledWith("alpha");

  await user.click(screen.getByLabelText("选择 alpha_creator"));
  expect(props.actions.toggleSelected).toHaveBeenCalledWith("creator-1");

  await user.clear(screen.getByLabelText("达人账号"));
  await user.type(screen.getByLabelText("达人账号"), "beta_creator");
  expect(props.actions.updateRow).toHaveBeenCalledWith(
    "creator-1",
    "username",
    expect.any(String),
  );

  await user.click(screen.getByRole("button", { name: "批量复制邀约话术" }));
  expect(props.actions.bulkCopyOutreach).toHaveBeenCalledTimes(1);
});

it("renders archived state and forwards restore without changing eligibility", async () => {
  const user = userEvent.setup();
  const row = creatorRow({
    archivedAt: "2026-06-11",
    archiveReason: "Manual",
  });
  const props = createProps({
    data: {
      ...createProps().data,
      rows: [
        {
          row,
          displayName: "alpha_creator",
          archived: true,
          canRestore: true,
          duplicate: {
            possibleDuplicate: false,
            multiSample: false,
            crossStoreCreator: false,
          },
        },
      ],
      archivedProductCount: 1,
    },
    uiState: {
      ...createProps().uiState,
      showArchivedCollaborations: true,
    },
  });

  render(<CreatorDatabasePage {...props} />);
  expect(screen.getByText("已归档")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "恢复达人" }));
  expect(props.actions.restoreCreator).toHaveBeenCalledWith("creator-1");
});
```

The search assertion deliberately checks the controlled callback boundary rather than expecting the component to accumulate local state.

- [ ] **Step 7: Run the focused component tests**

Run:

```bash
npm test -- src/features/creators/CreatorDatabasePage.test.tsx
```

Expected: PASS with 3 tests.

- [ ] **Step 8: Keep the component changes uncommitted and continue directly to App wiring**

Run `git status --short` and confirm the three new feature files are present. Do not commit yet: the component must be wired and the old inline JSX removed before the first reviewable commit.

---

#### Task 1 continued: Wire App State and Existing Operations Into the New Page

**Files:**

- Modify: `src/App.tsx:24-60`
- Modify: `src/App.tsx:1218-1325`
- Modify: `src/App.tsx:1778-1875`
- Modify: `src/App.tsx:3574-4053`
- Test: `src/App.test.tsx:601-850`

**Interfaces:**

- Consumes: `CreatorDatabasePage`, `CreatorDatabaseRowView`, and `CreatorStatusOption` from Task 1.
- Produces: an `App` render path that supplies the controlled page contract while retaining all state and business operations in `App.tsx`.

- [ ] **Step 9: Add imports without moving any domain helper**

Add:

```tsx
import { CreatorDatabasePage } from "./features/creators/CreatorDatabasePage";
import type {
  CreatorDatabaseRowView,
  CreatorStatusOption,
} from "./features/creators/creatorDatabaseTypes";
```

Keep `getDuplicateCheck`, `downloadCreatorRowsCsv`, `EditableCreatorField`, `DEFAULT_STORE_NAME`, `displayName`, `isArchivedCollaboration`, `buildOutreachForRow`, and persistence functions in their current modules or `App.tsx`.

- [ ] **Step 10: Build stable view data after `filteredRows`**

Immediately after the existing `filteredRows` memo, add:

```tsx
const creatorDatabaseRows = useMemo<CreatorDatabaseRowView[]>(
  () =>
    filteredRows.map((entry) => {
      const duplicate = getDuplicateCheck(entry.row, rows);
      return {
        row: entry.row,
        displayName: displayName(entry.row),
        archived: isArchivedCollaboration(entry.row),
        canRestore:
          isArchivedCollaboration(entry.row) &&
          entry.row.archiveReason === "Manual",
        duplicate: {
          possibleDuplicate: duplicate.possibleDuplicate,
          multiSample: duplicate.multiSample,
          crossStoreCreator: duplicate.crossStoreCreator,
        },
      };
    }),
  [filteredRows, rows],
);

const creatorStatusOptions: CreatorStatusOption[] = creatorStatuses.map(
  (status) => ({ value: status, label: displayStatus(status) }),
);
```

Do not move filtering, inferred status calculation, duplicate detection, or archived matching into the page component.

- [ ] **Step 11: Add narrow adapters for event-free component actions**

Keep existing domain operations unchanged. Add these adapters next to the corresponding handlers:

```tsx
function toggleAllFilteredCreators(checked: boolean) {
  setSelectedIds(checked ? filteredRows.map((entry) => entry.row.id) : []);
}

function copyCreatorOutreach(rowId: string) {
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row) return;
  void copyText(buildOutreachForRow(row), "已复制邀约话术。");
}
```

Retain `toggleSelected`, `handleBulkStatusUpdate`, `handleBulkCopyOutreach`, `updateRow`, `archiveCreator`, and `restoreCreator` without behavioral edits. Remove the old `toggleSelectAll(event)` only after the new adapter is wired and tests pass.

- [ ] **Step 12: Replace `renderCreatorDatabase` body with the controlled page**

Replace the old inline implementation with:

```tsx
function renderCreatorDatabase() {
  return (
    <CreatorDatabasePage
      data={{
        rows: creatorDatabaseRows,
        statusOptions: creatorStatusOptions,
        productTotalCount,
        archivedProductCount,
        archivedSearchMatchCount: archivedSearchMatches.length,
        defaultStoreName: DEFAULT_STORE_NAME,
      }}
      uiState={{
        search,
        statusFilter,
        creatorTypeFilter,
        followerFilter,
        avgViewsFilter,
        gmvFilter,
        selectedIds,
        showArchivedCollaborations,
        bulkStatus,
        fileName,
        importSummary,
        error,
        pendingDuplicate: pendingDuplicateAdd,
      }}
      actions={{
        setSearch,
        setStatusFilter: (value) =>
          setStatusFilter(value as CreatorStatus | "All"),
        setCreatorTypeFilter,
        setFollowerFilter,
        setAvgViewsFilter,
        setGmvFilter,
        setShowArchivedCollaborations,
        setBulkStatus: (value) => setBulkStatus(value as CreatorStatus),
        toggleSelected,
        toggleSelectAll: toggleAllFilteredCreators,
        updateRow,
        bulkCopyOutreach: handleBulkCopyOutreach,
        bulkUpdateStatus: handleBulkStatusUpdate,
        copyOutreach: copyCreatorOutreach,
        archiveCreator,
        restoreCreator,
        importFile: (file) => handleFile(file),
        exportCsv: () => downloadCreatorRowsCsv(rows),
        addCreator: handleAddCreator,
        continueDuplicate: () => {
          if (!pendingDuplicateAdd) return;
          addCreatorDraft(
            pendingDuplicateAdd.draft,
            pendingDuplicateAdd.existing,
          );
        },
        copyDuplicateBase: () => {
          if (!pendingDuplicateAdd) return;
          addCreatorDraft(
            pendingDuplicateAdd.draft,
            pendingDuplicateAdd.existing,
          );
        },
        cancelDuplicate: () => setPendingDuplicateAdd(null),
      }}
    />
  );
}
```

The two duplicate actions intentionally retain the current identical callback behavior. Do not treat that existing behavior as part of this refactor.

- [ ] **Step 13: Run the existing Creator Database integration tests**

Run:

```bash
npm test -- src/App.test.tsx -t "creator database redesigned table"
```

Expected: all tests in the `creator database redesigned table` describe block PASS without changing assertions.

- [ ] **Step 14: Run archive and historical-count regression tests**

Run:

```bash
npm test -- src/App.test.tsx -t "archive|archived|historical|product card totals"
```

Expected: matching archive, restore, historical visibility, and product total tests PASS.

- [ ] **Step 15: Remove only now-unused inline rendering code**

After Steps 5 and 6 pass:

- Delete the old JSX inside `renderCreatorDatabase`.
- Delete the old `renderImportCard` function only if `rg "renderImportCard" src/App.tsx` returns no callers.
- Delete the old `toggleSelectAll(ChangeEvent<HTMLInputElement>)` only if `rg "toggleSelectAll" src/App.tsx` returns no callers.
- Remove `ChangeEvent` or `ReactNode` from the React import only if `rg "ChangeEvent|ReactNode" src/App.tsx` confirms the symbol is unused elsewhere.
- Do not remove any other helper based on static graph suggestions.

- [ ] **Step 16: Run type checking and both component/integration tests**

Run:

```bash
npx tsc --noEmit --pretty false
npm test -- src/features/creators/CreatorDatabasePage.test.tsx
npm test -- src/App.test.tsx -t "creator database redesigned table"
```

Expected: type check PASS; focused component tests PASS with 3 tests; Creator Database integration tests PASS.

- [ ] **Step 17: Commit the complete extraction as one reviewable unit**

```bash
git add src/App.tsx \
  src/features/creators/creatorDatabaseTypes.ts \
  src/features/creators/CreatorDatabasePage.tsx \
  src/features/creators/CreatorDatabasePage.test.tsx
git commit -m "Extract controlled creator database page"
```

---

### Task 2: Verify Behavior Preservation and Prepare the Pull Request

**Files:**

- Verify: `src/App.tsx`
- Verify: `src/features/creators/creatorDatabaseTypes.ts`
- Verify: `src/features/creators/CreatorDatabasePage.tsx`
- Verify: `src/features/creators/CreatorDatabasePage.test.tsx`
- Do not modify: `src/App.test.tsx` unless a previously approved assertion correction exists.

**Interfaces:**

- Consumes: the complete controlled page and App wiring from Task 1.
- Produces: a review-ready, independently revertible PR that contains no business or persistence change.

- [ ] **Step 1: Confirm the diff contains only the intended extraction**

Run:

```bash
git diff main...HEAD --stat
git diff main...HEAD -- src/App.tsx \
  src/features/creators/creatorDatabaseTypes.ts \
  src/features/creators/CreatorDatabasePage.tsx \
  src/features/creators/CreatorDatabasePage.test.tsx
git diff --check main...HEAD
```

Expected: one new feature directory, mechanical removal/replacement in `App.tsx`, focused tests, and no whitespace errors. There must be no changes to `src/creatorData.ts`, `src/sopRules.ts`, `src/campaignData.ts`, API handlers, storage keys, or copy.

- [ ] **Step 2: Verify no old render path or accidental duplicate remains**

Run:

```bash
rg -n "function renderCreatorDatabase|function renderImportCard|toggleSelectAll" src/App.tsx
rg -n "CreatorDatabasePage" src/App.tsx src/features/creators
```

Expected: one small `renderCreatorDatabase` wrapper or one direct component render, no old inline page JSX, and one component implementation. `renderImportCard` and the event-based `toggleSelectAll` should be absent if they have no remaining callers.

- [ ] **Step 3: Run the full required verification under Node.js 22**

```bash
npm ci
npm test
npx tsc --noEmit --pretty false
npm run build
```

Expected:

- `npm ci`: PASS without modifying `package-lock.json`.
- `npm test`: PASS with at least 176 tests.
- TypeScript: PASS with no errors.
- Production build: PASS.

- [ ] **Step 4: Review user-visible invariants manually in the diff and test output**

Confirm all of the following:

- The 17 visible data columns remain in the same order.
- “样品物流状态” remains hidden.
- Search and all five dropdown filters remain controlled by `App.tsx`.
- Import, export, add creator, duplicate options, and errors render in the same order.
- Select-all operates on current filtered rows only.
- Bulk copy and bulk status behavior remain unchanged.
- Archived records remain hidden by default and restorable only when `archiveReason === "Manual"`.
- Completed/Failed archived records remain non-restorable.
- Row edits still flow through `updateRow` and persist through the existing `useEffect`.
- Duplicate badges and warnings are still calculated by `getDuplicateCheck` in `App.tsx`.

- [ ] **Step 5: Confirm the branch is clean and publish as a separate PR**

Run:

```bash
git status --short --branch
git log --oneline main..HEAD
```

Expected: clean working tree and the single focused extraction commit from Task 1.

Push the branch and create a PR with:

```text
Title: Extract controlled Creator Database page

Summary:
- move Creator Database markup into a typed controlled component
- keep state, persistence, filtering, duplicate detection, and operations in App
- add focused component tests while preserving existing integration coverage

Behavior change: None
```

Do not begin the Campaign Settings extraction until this PR is reviewed, CI passes, and it is merged into `main`.
