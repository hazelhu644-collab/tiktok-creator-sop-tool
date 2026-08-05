# Campaign Settings Page Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the controlled product Campaign settings and store-cleanup UI from `src/App.tsx` without changing UI, persistence, domain rules, or user-visible behavior.

**Architecture:** `App.tsx` remains the only owner of Campaigns, creators, stores, selection, persistence, identity matching, creation, rename, duplication, store migration/merge, archive, restore, delete, video-count synchronization, toast decisions, and prompt/confirm dialogs. A new `CampaignSettingsPage` receives a typed `{data, uiState, actions}` contract and renders only the existing page header, product-project settings section, and store-cleanup section. The ChatGPT helper and danger-zone JSX remain in `App.tsx` because they are not Campaign settings and would make this contract unstructured.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, jsdom, Node.js 22.

## Global Constraints

- Start from `e6c7493` or a newer latest `main` containing merged PR #63; do not stack on the design branch.
- Preserve UI layout, labels, interaction order, and product behavior exactly.
- Preserve every Campaign and creator `localStorage` key, schema, migration, persistence timing, and write order.
- Keep Campaign creation, duplication, rename, store assignment, duplicate-store merge, archive, restore, delete, identity matching, linked-row migration, video-count synchronization, and all toast decisions in `App.tsx`.
- Keep `window.prompt`, `window.confirm`, `setCampaigns`, `setRows`, `setSelectedStore`, `setSelectedCampaign`, and `setToast` calls in `App.tsx`.
- Keep ChatGPT helper state, prompt generation/copying, and the clear-local-creator-data danger zone in `App.tsx` in this PR.
- Do not introduce Context, Redux, another state library, a new dependency, a hook extraction, or a second source of truth.
- Do not change Campaign matching, store normalization, video fulfillment, archive/restore, DeepSeek/OpenAI, or creator priority behavior.
- Do not remove, skip, or broadly rewrite existing integration tests; the full suite must contain at least 181 tests before adding the focused component tests.
- Do not combine bug fixes, copy changes, formatting sweeps, or unused-code cleanup with this extraction.
- Run all required verification with Node.js 22.
- Create and wire the controlled page and remove the old inline Campaign/store JSX before the first reviewable commit; no committed intermediate may contain duplicate or unused page implementations.

---

## File Map

- Create `src/features/campaigns/campaignSettingsTypes.ts`: feature-local controlled-page contract and presentation view types.
- Create `src/features/campaigns/CampaignSettingsPage.tsx`: presentational page header, Campaign picker/actions/form, and store-cleanup section.
- Create `src/features/campaigns/CampaignSettingsPage.test.tsx`: focused rendering and callback-wiring tests.
- Modify `src/App.tsx`: construct the presentation view, retain every business operation, render the new page, and retain the ChatGPT helper and danger-zone JSX inline.
- Preserve existing assertions in `src/App.test.tsx`; add no integration test unless a concrete extraction regression is uncovered.

## Contract Locked for This PR

Create `src/features/campaigns/campaignSettingsTypes.ts` with exactly this contract. Do not add `appState`, setters, `unknown`, persistence objects, or a catch-all action.

```ts
import type { Campaign, Store } from "../../types";

export type CampaignSettingsOption = {
  value: string;
  label: string;
};

export type CampaignSettingsTargetView = {
  campaign: Campaign;
  selectValue: string;
  storeId: string;
  keyContentPointsText: string;
  productLinkRequirementText: string;
  referenceLinksText: string;
};

export type CampaignStoreCleanupView = {
  id: string;
  name: string;
  canHide: boolean;
};

export type CampaignSettingsData = {
  target: CampaignSettingsTargetView | null;
  campaignOptions: CampaignSettingsOption[];
  storeOptions: Store[];
  storeCleanupItems: CampaignStoreCleanupView[];
};

export type CampaignSettingsUiState = {
  showArchivedProducts: boolean;
};

export type CampaignSettingsActions = {
  selectCampaign: (value: string) => void;
  setShowArchivedProducts: (value: boolean) => void;
  createCampaign: () => void;
  announceEditable: () => void;
  duplicateCampaign: () => void;
  archiveCampaign: () => void;
  restoreCampaign: () => void;
  deleteCampaign: () => void;
  assignStore: (storeId: string) => void;
  renameProduct: (productName: string) => void;
  updateKeyContentPoints: (value: string) => void;
  updateSellingPoints: (value: string) => void;
  updateVideoLength: (value: string) => void;
  updateVideoCount: (value: string) => void;
  syncVideoCount: () => void;
  updateAvoidShots: (value: string) => void;
  updateProductLinkRequirement: (value: string) => void;
  updateReferenceLinks: (value: string) => void;
  inspectStore: (storeId: string) => void;
};

export type CampaignSettingsPageProps = {
  data: CampaignSettingsData;
  uiState: CampaignSettingsUiState;
  actions: CampaignSettingsActions;
};
```

### Task 1: Build and Wire the Controlled Campaign Settings Page

**Files:**

- Create: `src/features/campaigns/campaignSettingsTypes.ts`
- Create: `src/features/campaigns/CampaignSettingsPage.test.tsx`
- Create: `src/features/campaigns/CampaignSettingsPage.tsx`
- Modify: `src/App.tsx:1-60`
- Modify: `src/App.tsx:3987-4613`
- Preserve: `src/App.tsx:4614-4733`

**Interfaces:**

- Consumes: `Campaign` and `Store` from `src/types.ts` and the exact contract above.
- Produces: `CampaignSettingsPage(props: CampaignSettingsPageProps): JSX.Element` plus an `App` render path that passes presentation data and callbacks while retaining all business logic.

- [ ] **Step 1: Create the exact contract**

Create `src/features/campaigns/campaignSettingsTypes.ts` using the complete “Contract Locked for This PR” code. Do not import any state setter, persistence helper, Campaign matcher, or normalization helper from `App.tsx`.

- [ ] **Step 2: Write the focused controlled fixture and first failing render test**

Create `src/features/campaigns/CampaignSettingsPage.test.tsx` with this fixture and rendering test:

```tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Campaign } from "../../types";
import { CampaignSettingsPage } from "./CampaignSettingsPage";
import type { CampaignSettingsPageProps } from "./campaignSettingsTypes";

function campaign(patch: Partial<Campaign> = {}): Campaign {
  return {
    id: "pet-brush",
    productId: "product::terrapaw::pet-brush",
    storeId: "terrapaw",
    storeName: "TerraPaw",
    productName: "Pet Brush",
    sellingPoints: "Gentle steam grooming",
    requirements: [],
    keyContentPoints: ["Show steam"],
    avoidShots: "No medical claims",
    videoCount: "2",
    videoLength: "40s+",
    tagRequirement: "Tag the product",
    productLink: "",
    referenceLinks: ["https://example.com/reference"],
    defaultMessageSetting: "",
    notes: "",
    ...patch,
  };
}

function createProps(
  overrides: Partial<CampaignSettingsPageProps> = {},
): CampaignSettingsPageProps {
  const targetCampaign = campaign();
  const base: CampaignSettingsPageProps = {
    data: {
      target: {
        campaign: targetCampaign,
        selectValue: "terrapaw::pet-brush",
        storeId: "terrapaw",
        keyContentPointsText: "Show steam",
        productLinkRequirementText: "Tag the product",
        referenceLinksText: "https://example.com/reference",
      },
      campaignOptions: [
        { value: "terrapaw::pet-brush", label: "TerraPaw · Pet Brush" },
      ],
      storeOptions: [
        { id: "terrapaw", name: "TerraPaw" },
        { id: "pinepaw", name: "PinePaw" },
      ],
      storeCleanupItems: [
        { id: "terrapaw", name: "TerraPaw", canHide: false },
        { id: "empty-store", name: "Empty Store", canHide: true },
      ],
    },
    uiState: { showArchivedProducts: false },
    actions: {
      selectCampaign: vi.fn(),
      setShowArchivedProducts: vi.fn(),
      createCampaign: vi.fn(),
      announceEditable: vi.fn(),
      duplicateCampaign: vi.fn(),
      archiveCampaign: vi.fn(),
      restoreCampaign: vi.fn(),
      deleteCampaign: vi.fn(),
      assignStore: vi.fn(),
      renameProduct: vi.fn(),
      updateKeyContentPoints: vi.fn(),
      updateSellingPoints: vi.fn(),
      updateVideoLength: vi.fn(),
      updateVideoCount: vi.fn(),
      syncVideoCount: vi.fn(),
      updateAvoidShots: vi.fn(),
      updateProductLinkRequirement: vi.fn(),
      updateReferenceLinks: vi.fn(),
      inspectStore: vi.fn(),
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

describe("CampaignSettingsPage", () => {
  it("renders the controlled campaign form and store cleanup state", () => {
    render(<CampaignSettingsPage {...createProps()} />);

    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("选择产品 / Campaign")).toHaveValue(
      "terrapaw::pet-brush",
    );
    const form = within(screen.getByTestId("campaign-settings-form"));
    expect(form.getByLabelText("店铺 / 品牌")).toHaveValue("terrapaw");
    expect(form.getByLabelText("产品名称")).toHaveValue("Pet Brush");
    expect(form.getByLabelText("必须展示内容")).toHaveValue("Show steam");
    expect(form.getByLabelText("Campaign 产品卖点")).toHaveValue(
      "Gentle steam grooming",
    );
    expect(
      screen.getByRole("button", { name: "检查店铺：TerraPaw" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "隐藏空店铺：Empty Store" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the first test and confirm RED**

Run:

```bash
npm test -- src/features/campaigns/CampaignSettingsPage.test.tsx
```

Expected: FAIL because `./CampaignSettingsPage` does not exist.

- [ ] **Step 4: Implement the presentational page by moving existing JSX**

Create `CampaignSettingsPage.tsx`. It must:

1. Import only `CampaignSettingsPageProps` from `./campaignSettingsTypes`.
2. Render the exact page-header markup currently produced for title `设置` and description `管理产品项目、拍摄要求、提示词助手和本地数据。`.
3. Move the existing “产品项目设置” section from `App.tsx:4336-4566` without changing classes, labels, text, order, conditional rendering, or HTML element types.
4. Replace option mapping with `data.campaignOptions`; use `data.target?.selectValue` for the select value.
5. Replace target Campaign/store/text values with `data.target` view fields.
6. Replace every inline App callback with its exact `actions` counterpart.
7. Move the existing “店铺清理” section from `App.tsx:4567-4613`; map `data.storeCleanupItems` and call `actions.inspectStore(item.id)`.
8. Return no ChatGPT-helper or danger-zone JSX.
9. Read no localStorage, call no Campaign helper, and hold no React state/effect.

The field mapping is locked:

| Existing UI event    | Controlled callback                           |
| -------------------- | --------------------------------------------- |
| Campaign select      | `actions.selectCampaign(value)`               |
| archived checkbox    | `actions.setShowArchivedProducts(checked)`    |
| 新增产品             | `actions.createCampaign()`                    |
| 编辑                 | `actions.announceEditable()`                  |
| 复制                 | `actions.duplicateCampaign()`                 |
| 归档                 | `actions.archiveCampaign()`                   |
| 恢复                 | `actions.restoreCampaign()`                   |
| 删除                 | `actions.deleteCampaign()`                    |
| 店铺 / 品牌          | `actions.assignStore(value)`                  |
| 产品名称             | `actions.renameProduct(value)`                |
| 必须展示内容         | `actions.updateKeyContentPoints(value)`       |
| 产品卖点             | `actions.updateSellingPoints(value)`          |
| 视频时长要求         | `actions.updateVideoLength(value)`            |
| 视频数量要求         | `actions.updateVideoCount(value)`             |
| 同步视频数量         | `actions.syncVideoCount()`                    |
| 不希望达人这样拍     | `actions.updateAvoidShots(value)`             |
| 挂车要求             | `actions.updateProductLinkRequirement(value)` |
| 参考视频链接         | `actions.updateReferenceLinks(value)`         |
| store cleanup button | `actions.inspectStore(item.id)`               |

- [ ] **Step 5: Run the rendering test and confirm GREEN**

Run the focused component test. Expected: PASS with 1 test.

- [ ] **Step 6: Add callback and archived-state tests**

Append two tests inside the same `describe`:

```tsx
it("forwards controlled selection, editing, campaign actions, and store checks", async () => {
  const user = userEvent.setup();
  const props = createProps();
  render(<CampaignSettingsPage {...props} />);

  fireEvent.change(screen.getByLabelText("选择产品 / Campaign"), {
    target: { value: "terrapaw::pet-brush" },
  });
  expect(props.actions.selectCampaign).toHaveBeenCalledWith(
    "terrapaw::pet-brush",
  );

  await user.click(screen.getByLabelText("显示已归档产品"));
  expect(props.actions.setShowArchivedProducts).toHaveBeenCalledWith(true);

  const form = within(screen.getByTestId("campaign-settings-form"));
  fireEvent.change(form.getByLabelText("店铺 / 品牌"), {
    target: { value: "pinepaw" },
  });
  expect(props.actions.assignStore).toHaveBeenCalledWith("pinepaw");
  fireEvent.change(form.getByLabelText("产品名称"), {
    target: { value: "New Brush" },
  });
  expect(props.actions.renameProduct).toHaveBeenCalledWith("New Brush");
  fireEvent.change(form.getByLabelText("视频数量要求"), {
    target: { value: "1" },
  });
  expect(props.actions.updateVideoCount).toHaveBeenCalledWith("1");

  await user.click(
    screen.getByRole("button", { name: "同步视频数量到达人记录" }),
  );
  expect(props.actions.syncVideoCount).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "复制" }));
  expect(props.actions.duplicateCampaign).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "检查店铺：TerraPaw" }));
  expect(props.actions.inspectStore).toHaveBeenCalledWith("terrapaw");
});

it("preserves archived restore controls and the no-target state", async () => {
  const user = userEvent.setup();
  const archived = campaign({ archivedAt: "2026-06-22" });
  const props = createProps({
    data: {
      ...createProps().data,
      target: {
        ...createProps().data.target!,
        campaign: archived,
      },
    },
    uiState: { showArchivedProducts: true },
  });
  const { rerender } = render(<CampaignSettingsPage {...props} />);
  await user.click(screen.getByRole("button", { name: "恢复" }));
  expect(props.actions.restoreCampaign).toHaveBeenCalledTimes(1);

  rerender(
    <CampaignSettingsPage
      {...createProps({ data: { ...createProps().data, target: null } })}
    />,
  );
  expect(
    screen.queryByTestId("campaign-settings-form"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "新增产品" }),
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 7: Run focused tests**

Expected: 3 passing tests with no React warnings.

- [ ] **Step 8: Wire the component in `App.tsx` without moving business logic**

Add imports:

```tsx
import { CampaignSettingsPage } from "./features/campaigns/CampaignSettingsPage";
import type {
  CampaignSettingsOption,
  CampaignSettingsTargetView,
  CampaignStoreCleanupView,
} from "./features/campaigns/campaignSettingsTypes";
```

Inside `renderSettings`, retain every existing business helper from `targetCampaign` through `deleteCampaign` byte-for-byte except for formatting required by moved line numbers. After those helpers, derive:

```tsx
const campaignSettingsTarget: CampaignSettingsTargetView | null = targetCampaign
  ? {
      campaign: targetCampaign,
      selectValue: campaignSelectValue(targetCampaign),
      storeId: normalizeStoreId(
        targetCampaign.storeId,
        targetCampaign.storeName,
      ),
      keyContentPointsText: listToText(targetCampaign.keyContentPoints),
      productLinkRequirementText: [
        targetCampaign.tagRequirement,
        targetCampaign.productLink,
      ]
        .filter(Boolean)
        .join("\n"),
      referenceLinksText: listToText(targetCampaign.referenceLinks),
    }
  : null;

const campaignSettingsOptions: CampaignSettingsOption[] = activeCampaigns.map(
  (campaign) => ({
    value: campaignSelectValue(campaign),
    label: `${campaignLabel(campaign, showStoreLabels)}${
      campaign.archivedAt ? "（已归档）" : ""
    }`,
  }),
);

const campaignStoreCleanupItems: CampaignStoreCleanupView[] = stores.map(
  (store) => {
    const linkedCampaigns = mergedCampaigns.filter(
      (campaign) =>
        normalizeStoreId(campaign.storeId, campaign.storeName) === store.id &&
        !campaign.archivedAt,
    ).length;
    const linkedRows = rows.filter(
      (row) => rowStoreId(row) === store.id,
    ).length;
    return {
      id: store.id,
      name: store.name,
      canHide: linkedCampaigns === 0 && linkedRows === 0,
    };
  },
);
```

Render `CampaignSettingsPage` first in the returned fragment. Wire actions exactly:

```tsx
<CampaignSettingsPage
  data={{
    target: campaignSettingsTarget,
    campaignOptions: campaignSettingsOptions,
    storeOptions: stores,
    storeCleanupItems: campaignStoreCleanupItems,
  }}
  uiState={{ showArchivedProducts }}
  actions={{
    selectCampaign: setSelectedCampaign,
    setShowArchivedProducts,
    createCampaign,
    announceEditable: () =>
      setToast({ tone: "success", text: "可直接在下方编辑产品字段。" }),
    duplicateCampaign: () => {
      if (targetCampaign) duplicateCampaign(targetCampaign);
    },
    archiveCampaign: () => {
      if (targetCampaign) archiveCampaign(targetCampaign);
    },
    restoreCampaign: () => {
      if (targetCampaign) restoreCampaign(targetCampaign);
    },
    deleteCampaign: () => {
      if (targetCampaign) deleteCampaign(targetCampaign);
    },
    assignStore: (storeId) => {
      if (targetCampaign) assignCampaignStore(targetCampaign, storeId);
    },
    renameProduct: (productName) => {
      if (targetCampaign)
        updateCampaignProductName(targetCampaign, productName);
    },
    updateKeyContentPoints: (value) =>
      updateCampaign({ keyContentPoints: normalizeListText(value) }),
    updateSellingPoints: (value) => updateCampaign({ sellingPoints: value }),
    updateVideoLength: (value) => updateCampaign({ videoLength: value }),
    updateVideoCount: (value) => updateCampaign({ videoCount: value }),
    syncVideoCount: () => {
      if (targetCampaign) syncCampaignVideoCount(targetCampaign);
    },
    updateAvoidShots: (value) => updateCampaign({ avoidShots: value }),
    updateProductLinkRequirement: (value) =>
      updateCampaign({ tagRequirement: value, productLink: "" }),
    updateReferenceLinks: (value) =>
      updateCampaign({ referenceLinks: normalizeListText(value) }),
    inspectStore: (storeId) => {
      const item = campaignStoreCleanupItems.find(
        (entry) => entry.id === storeId,
      );
      if (!item) return;
      setToast(
        item.canHide
          ? {
              tone: "success",
              text: `${item.name} 已无关联产品或达人记录，会从店铺下拉中隐藏。`,
            }
          : {
              tone: "warning",
              text: "该店铺仍有关联产品或达人记录，请先迁移或合并后再删除。",
            },
      );
    },
  }}
/>
```

Immediately after it, retain the existing ChatGPT-helper section and danger-zone section unchanged. Remove only the old page header, product-project section, and store-cleanup section now rendered by the component.

- [ ] **Step 9: Run focused integration safety nets**

Run these existing tests under Node 22:

```bash
npm test -- src/App.test.tsx -t "store selector for campaigns|moves a campaign|merges duplicate product campaigns|creates new campaigns|syncs immediately edited campaign|matches sync rows"
npm test -- src/App.test.tsx -t "prefills saved reference links|generates and copies a local ChatGPT prompt|clears local creator data"
```

Expected: all selected tests PASS; prompt helper and danger behavior remain owned by `App`.

- [ ] **Step 10: Run static checks and the full suite**

```bash
npx tsc --noEmit --pretty false
npm test
git diff --check
```

Expected: typecheck passes, at least 184 tests pass (181 baseline + 3 focused), and no whitespace errors.

- [ ] **Step 11: Verify the boundary before committing**

Run:

```bash
rg -n "localStorage|setCampaigns|setRows|setSelectedStore|setSelectedCampaign|setToast|window\\.(prompt|confirm)|campaignIdentity|rowMatchesCampaign" src/features/campaigns
rg -n "产品项目设置|店铺清理" src/App.tsx src/features/campaigns/CampaignSettingsPage.tsx
git status --short
```

Expected: the feature directory contains none of the forbidden ownership calls/helpers; each moved heading exists only once in `CampaignSettingsPage.tsx`; the worktree contains the three new feature files and `src/App.tsx` modification only.

- [ ] **Step 12: Commit the complete extraction**

```bash
git add src/App.tsx src/features/campaigns/campaignSettingsTypes.ts src/features/campaigns/CampaignSettingsPage.tsx src/features/campaigns/CampaignSettingsPage.test.tsx
git commit -m "Extract controlled campaign settings page"
```

### Task 2: Verify Behavior Preservation and Prepare the Pull Request

**Files:**

- Verify: `src/App.tsx`
- Verify: `src/features/campaigns/campaignSettingsTypes.ts`
- Verify: `src/features/campaigns/CampaignSettingsPage.tsx`
- Verify: `src/features/campaigns/CampaignSettingsPage.test.tsx`
- Preserve: `src/App.test.tsx`

**Interfaces:**

- Consumes: the complete controlled Campaign settings page from Task 1.
- Produces: a review-ready, independently revertible PR containing no persistence or business change.

- [ ] **Step 1: Audit the focused diff**

```bash
git diff origin/main...HEAD --stat
git diff --check origin/main...HEAD
git diff origin/main...HEAD -- src/App.tsx src/features/campaigns
```

Expected: only the intended `App.tsx` extraction and three feature files. No change to `campaignData.ts`, `creatorData.ts`, `sopRules.ts`, storage keys, API handlers, dependencies, or copy.

- [ ] **Step 2: Confirm no duplicated Campaign/store render path remains**

```bash
rg -n "产品项目设置|店铺清理|CampaignSettingsPage" src/App.tsx src/features/campaigns
rg -n "用 ChatGPT 辅助生成拍摄要求|危险操作" src/App.tsx src/features/campaigns
```

Expected: Campaign/store headings and markup occur only in the component; `App.tsx` owns the ChatGPT and danger sections; there is one component implementation.

- [ ] **Step 3: Run final Node.js 22 verification**

```bash
npm ci
npm test
npx tsc --noEmit --pretty false
npm run build
```

Expected: lockfile unchanged, at least 184 tests pass, typecheck passes, and production build passes.

- [ ] **Step 4: Manually verify invariants**

Confirm in the diff and tests:

- Campaign selector labels and archived suffix are unchanged.
- The Campaign action button order remains 新增、编辑、复制、归档、恢复 when applicable、删除.
- All form labels, field order, helper copy, and automatic-save copy are unchanged.
- Store assignment and duplicate merge still use the same App functions and prompt/confirm strings.
- Rename still updates linked creator product names and blocks same-store duplicates.
- Video synchronization still preserves posted/over-delivered counts.
- Store cleanup still bases its result on active Campaign and creator links and only sets the existing toast.
- ChatGPT helper and clear-data danger zone remain inline and behaviorally unchanged.
- Campaign and creator persistence effects and keys are untouched.

- [ ] **Step 5: Publish a separate PR without merging**

Confirm a clean branch, push it, and create:

```text
Title: Extract controlled Campaign Settings page

Summary:
- move Campaign and store settings markup into a typed controlled component
- keep creation, migration, matching, persistence, prompts, and toast decisions in App
- add focused component tests while preserving Campaign integration coverage

Behavior change: None
```

Do not start Message Composer extraction until this PR is reviewed, CI passes, and it is merged into `main`.
