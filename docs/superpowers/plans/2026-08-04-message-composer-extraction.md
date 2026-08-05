# Message Composer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the controlled “达人回复处理” composer panel from `src/App.tsx` without changing UI, API behavior, local fallback generation, tracking updates, or user-visible behavior.

**Architecture:** `App.tsx` remains the only owner of selected creators, reply/message state, DeepSeek requests, local fallback generation, validation, error classification, clipboard side effects, tracking/history mutations, persistence, queue navigation, and scrolling. A new `MessageComposer` receives a typed `{data, uiState, actions}` contract and renders the existing reply, translation, English-message editing, and post-send tracking interface. The workbench queue, current-creator summary, Campaign requirements, and all business operations remain in `App.tsx`.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, jsdom, Node.js 22.

## Global Constraints

- Start from `ecd344d` or a newer latest `main` containing merged PR #64; do not stack on the design branch.
- Preserve UI layout, classes, labels, helper copy, conditional rendering, element order, disabled states, and product behavior exactly.
- Preserve every creator/Campaign `localStorage` key, schema, migration, persistence timing, and write order.
- Keep selected-creator logic, local message generation, DeepSeek payload building/fetch/error handling/fallback, state transitions, clipboard effects, scroll behavior, tracking/history mutations, queue progression, and toast decisions in `App.tsx`.
- Keep `fetch`, `generateMessage`, `copyText`, `setRows`, `setMessage`, `setMessageSource`, DeepSeek result setters, `finishProcessing`, `updateRow`, and every persistence call in `App.tsx`.
- Keep the workbench queue, current-creator details, duplicate warnings, Campaign requirements, and no-selected-creator empty state in `App.tsx`.
- Do not change DeepSeek/OpenAI routes, request payloads, response handling, API-key error copy, local fallback behavior, Campaign matching, video fulfillment, creator priority, or archive/restore behavior.
- Do not introduce Context, Redux, another state library, a hook extraction, a new dependency, or a second source of truth.
- Do not remove, skip, or broadly rewrite existing integration tests; the full suite must contain at least 184 tests before adding focused component tests.
- Do not combine bug fixes, copy changes, formatting sweeps, or unused-code cleanup with this extraction.
- Run all required verification with Node.js 22.
- Create and wire the controlled component and remove the old inline panel before the first reviewable commit; no committed intermediate may contain duplicate or unused composer implementations.

---

## File Map

- Create `src/features/messaging/messageComposerTypes.ts`: feature-local controlled contract.
- Create `src/features/messaging/MessageComposer.tsx`: presentational reply, translation, English message, and tracking panel.
- Create `src/features/messaging/MessageComposer.test.tsx`: focused rendering, callback, loading/error, read-only, and next-creator tests.
- Modify `src/App.tsx`: derive display-only error/data fields, adapt existing handlers, attach the existing message scroll ref, render the component, and remove only the old inline reply panel.
- Preserve `src/App.test.tsx`: keep the existing DeepSeek, local fallback, copy, tracking, and reply integration safety net unchanged.

## Contract Locked for This PR

Create `src/features/messaging/messageComposerTypes.ts` with exactly this contract. Do not add `appState`, state setters, `unknown`, persistence objects, API payloads, or a catch-all action.

```ts
import type { RefObject } from "react";
import type { ReplyTone } from "../../messageGenerator";
import type { Channel, GeneratedMessage } from "../../types";

export type MessageComposerLoadingAction =
  "translate_creator_reply" | "generate_personalized_reply" | null;

export type MessageComposerData = {
  creatorReply: string;
  notes: string;
  channel: Channel;
  chineseTranslation: string;
  errorMessage: string;
  message: GeneratedMessage | null;
  messageSource: "local" | "deepseek";
  chineseExplanation: string;
  trackingStatus: string;
  lastProcessingResult: string;
  hasNextTask: boolean;
};

export type MessageComposerUiState = {
  historicalReadOnly: boolean;
  loadingAction: MessageComposerLoadingAction;
  translationExpanded: boolean;
  translationEditing: boolean;
  advancedReplyOpen: boolean;
  replyFocus: string;
  relationshipNote: string;
  replyTone: ReplyTone;
  replyGoal: string;
  replyConcession: string;
  showNextCreatorPrompt: boolean;
  messageOutputRef: RefObject<HTMLDivElement | null>;
};

export type MessageComposerActions = {
  updateCreatorReply: (value: string) => void;
  updateNotes: (value: string) => void;
  generateDeepSeekReply: () => void;
  translateCreatorReply: () => void;
  copyTranslation: () => void;
  updateTranslation: (value: string) => void;
  setTranslationExpanded: (value: boolean) => void;
  setTranslationEditing: (value: boolean) => void;
  setReplyFocus: (value: string) => void;
  setReplyTone: (value: ReplyTone) => void;
  setAdvancedReplyOpen: (value: boolean) => void;
  setRelationshipNote: (value: string) => void;
  setReplyGoal: (value: string) => void;
  setReplyConcession: (value: string) => void;
  updateEnglishMessage: (value: string) => void;
  copyEnglishMessage: () => void;
  markMessageSent: () => void;
  markCreatorReplied: () => void;
  markCreatorNoReply: () => void;
  markVideoProgress: () => void;
  updateVideoProgressManually: () => void;
  markCreatorOutcome: (outcome: "Completed" | "Failed") => void;
  markCreatorSkippedToday: () => void;
  processNextCreator: () => void;
  stayOnCurrentCreator: () => void;
};

export type MessageComposerProps = {
  data: MessageComposerData;
  uiState: MessageComposerUiState;
  actions: MessageComposerActions;
};
```

### Task 1: Build and Wire the Controlled Message Composer

**Files:**

- Create: `src/features/messaging/messageComposerTypes.ts`
- Create: `src/features/messaging/MessageComposer.test.tsx`
- Create: `src/features/messaging/MessageComposer.tsx`
- Modify: `src/App.tsx:1-65`
- Modify: `src/App.tsx:2758-2776`
- Modify: `src/App.tsx:3155-3532`

**Interfaces:**

- Consumes: `ReplyTone`, `Channel`, `GeneratedMessage`, and the exact controlled contract above.
- Produces: `MessageComposer(props: MessageComposerProps): JSX.Element` plus an App render path that preserves all existing state and business ownership.

- [ ] **Step 1: Create the exact contract file**

Create `src/features/messaging/messageComposerTypes.ts` with the complete code in “Contract Locked for This PR.” Do not import App helpers, API functions, storage helpers, or state setters.

- [ ] **Step 2: Write the focused fixture and first failing render test**

Create `src/features/messaging/MessageComposer.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "./MessageComposer";
import type { MessageComposerProps } from "./messageComposerTypes";

function createProps(
  overrides: Partial<MessageComposerProps> = {},
): MessageComposerProps {
  const base: MessageComposerProps = {
    data: {
      creatorReply: "I can post Friday.",
      notes: "Creator prefers weekends",
      channel: "TikTok DM",
      chineseTranslation: "我可以周五发布。",
      errorMessage: "",
      message: {
        english: "Thanks! Please confirm the posting time.",
        chineseExplanation: "确认具体发布时间。",
        scenario: "达人已回复",
        scenarioReason: "达人确认可以发布",
        urgencyLevel: "中",
        communicationAction: "回复达人消息",
      },
      messageSource: "local",
      chineseExplanation: "",
      trackingStatus: "",
      lastProcessingResult: "",
      hasNextTask: true,
    },
    uiState: {
      historicalReadOnly: false,
      loadingAction: null,
      translationExpanded: false,
      translationEditing: false,
      advancedReplyOpen: false,
      replyFocus: "确认周五发布时间",
      relationshipNote: "沟通顺畅",
      replyTone: "中立专业",
      replyGoal: "确认发布时间",
      replyConcession: "可以周五发布",
      showNextCreatorPrompt: false,
      messageOutputRef: createRef<HTMLDivElement>(),
    },
    actions: {
      updateCreatorReply: vi.fn(),
      updateNotes: vi.fn(),
      generateDeepSeekReply: vi.fn(),
      translateCreatorReply: vi.fn(),
      copyTranslation: vi.fn(),
      updateTranslation: vi.fn(),
      setTranslationExpanded: vi.fn(),
      setTranslationEditing: vi.fn(),
      setReplyFocus: vi.fn(),
      setReplyTone: vi.fn(),
      setAdvancedReplyOpen: vi.fn(),
      setRelationshipNote: vi.fn(),
      setReplyGoal: vi.fn(),
      setReplyConcession: vi.fn(),
      updateEnglishMessage: vi.fn(),
      copyEnglishMessage: vi.fn(),
      markMessageSent: vi.fn(),
      markCreatorReplied: vi.fn(),
      markCreatorNoReply: vi.fn(),
      markVideoProgress: vi.fn(),
      updateVideoProgressManually: vi.fn(),
      markCreatorOutcome: vi.fn(),
      markCreatorSkippedToday: vi.fn(),
      processNextCreator: vi.fn(),
      stayOnCurrentCreator: vi.fn(),
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

describe("MessageComposer", () => {
  it("renders controlled reply, translation, English message, and tracking UI", () => {
    render(<MessageComposer {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "达人回复处理" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("达人回复原文")).toHaveValue(
      "I can post Friday.",
    );
    expect(screen.getByText("我可以周五发布。")).toBeInTheDocument();
    expect(screen.getByLabelText("英文话术")).toHaveValue(
      "Thanks! Please confirm the posting time.",
    );
    expect(screen.getByText("免费本地话术")).toBeInTheDocument();
    expect(screen.getByText("当前联系渠道：TikTok DM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记为已发送" })).toBeEnabled();
  });
});
```

- [ ] **Step 3: Run the focused test and confirm RED**

```bash
npm test -- src/features/messaging/MessageComposer.test.tsx
```

Expected: FAIL because `./MessageComposer` does not exist.

- [ ] **Step 4: Implement the presentational component by moving existing JSX**

Create `MessageComposer.tsx`. It must:

1. Import only `MessageComposerProps` and `ReplyTone` as types.
2. Move the complete existing reply panel from `App.tsx:3156-3531` without changing markup, classes, labels, helper text, order, conditions, or disabled behavior.
3. Replace every read with the corresponding `data` or `uiState` value.
4. Replace every event with its exact `actions` callback.
5. Attach `uiState.messageOutputRef` to the existing `.message-output` div so `scrollToMessageArea()` retains its current target.
6. Render `data.errorMessage` directly; do not inspect API-key strings or reinterpret errors.
7. Call neither `fetch`, `generateMessage`, `copyText`, persistence helpers, App domain helpers, nor React state/effects.

The mapping is locked:

| Existing event/value                 | Controlled boundary                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- |
| current creator reply                | `data.creatorReply` / `actions.updateCreatorReply(value)`              |
| notes                                | `data.notes` / `actions.updateNotes(value)`                            |
| both generate buttons                | `actions.generateDeepSeekReply()`                                      |
| translate button                     | `actions.translateCreatorReply()`                                      |
| translation copy/edit/expand         | matching translation actions                                           |
| reply focus/tone/advanced fields     | matching controlled UI values/actions                                  |
| generated message/source/explanation | `data.message`, `data.messageSource`, `data.chineseExplanation`        |
| English edit/copy                    | `actions.updateEnglishMessage(value)` / `actions.copyEnglishMessage()` |
| tracking buttons                     | matching mark/update actions                                           |
| outcome buttons                      | `actions.markCreatorOutcome("Completed"                                | "Failed")` |
| next/stay buttons                    | `actions.processNextCreator()` / `actions.stayOnCurrentCreator()`      |

- [ ] **Step 5: Run the first component test and confirm GREEN**

Expected: 1 test passes with no React warnings.

- [ ] **Step 6: Add controlled callbacks and translation-state tests**

Append:

```tsx
it("forwards reply, DeepSeek, translation, and English editing callbacks", async () => {
  const user = userEvent.setup();
  const props = createProps();
  render(<MessageComposer {...props} />);

  fireEvent.change(screen.getByLabelText("达人回复原文"), {
    target: { value: "Updated reply" },
  });
  expect(props.actions.updateCreatorReply).toHaveBeenCalledWith(
    "Updated reply",
  );
  fireEvent.change(screen.getByLabelText("处理备注 / 达人备注"), {
    target: { value: "Updated note" },
  });
  expect(props.actions.updateNotes).toHaveBeenCalledWith("Updated note");

  await user.click(
    screen.getByRole("button", { name: "DeepSeek 翻译达人回复" }),
  );
  expect(props.actions.translateCreatorReply).toHaveBeenCalledTimes(1);
  await user.click(
    screen.getAllByRole("button", { name: "根据上方重点生成英文回复" })[0],
  );
  expect(props.actions.generateDeepSeekReply).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "复制翻译" }));
  expect(props.actions.copyTranslation).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "展开全文" }));
  expect(props.actions.setTranslationExpanded).toHaveBeenCalledWith(true);
  await user.click(screen.getByRole("button", { name: "编辑翻译" }));
  expect(props.actions.setTranslationEditing).toHaveBeenCalledWith(true);

  fireEvent.change(screen.getByLabelText("我想回复的重点"), {
    target: { value: "Confirm Friday" },
  });
  expect(props.actions.setReplyFocus).toHaveBeenCalledWith("Confirm Friday");
  fireEvent.change(screen.getByLabelText("回复语气"), {
    target: { value: "坚定推进" },
  });
  expect(props.actions.setReplyTone).toHaveBeenCalledWith("坚定推进");
  fireEvent.change(screen.getByLabelText("英文话术"), {
    target: { value: "Edited English" },
  });
  expect(props.actions.updateEnglishMessage).toHaveBeenCalledWith(
    "Edited English",
  );
  await user.click(screen.getByRole("button", { name: "复制英文话术" }));
  expect(props.actions.copyEnglishMessage).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "标记为已发送" }));
  expect(props.actions.markMessageSent).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "标记达人已回复" }));
  expect(props.actions.markCreatorReplied).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "标记未回复" }));
  expect(props.actions.markCreatorNoReply).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "发布 1 条视频" }));
  expect(props.actions.markVideoProgress).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "今日暂不跟进" }));
  expect(props.actions.markCreatorSkippedToday).toHaveBeenCalledTimes(1);
});

it("renders loading, editable translation, and API error state without interpreting it", () => {
  const props = createProps({
    data: {
      ...createProps().data,
      errorMessage: "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
    },
    uiState: {
      ...createProps().uiState,
      loadingAction: "translate_creator_reply",
      translationEditing: true,
      translationExpanded: true,
    },
  });
  render(<MessageComposer {...props} />);

  expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 生成中…");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
  );
  expect(screen.getByLabelText("编辑中文翻译")).toHaveValue("我可以周五发布。");
  expect(screen.getByRole("button", { name: "收起" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "完成编辑" })).toBeInTheDocument();
});
```

- [ ] **Step 7: Add tracking/read-only and next-creator tests**

Append:

```tsx
it("forwards tracking actions and preserves historical disabled states", async () => {
  const user = userEvent.setup();
  const props = createProps({
    uiState: {
      ...createProps().uiState,
      historicalReadOnly: true,
      showNextCreatorPrompt: true,
    },
    data: {
      ...createProps().data,
      trackingStatus: "已记录处理结果。",
      lastProcessingResult: "已记录处理结果。",
      hasNextTask: false,
    },
  });
  render(<MessageComposer {...props} />);

  expect(screen.getByRole("button", { name: "标记为已发送" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "标记达人已回复" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "标记未回复" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "发布 1 条视频" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "今日暂不跟进" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "处理下一个达人" })).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "留在当前达人" }));
  expect(props.actions.stayOnCurrentCreator).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 8: Run focused tests**

Expected: 4 tests pass with no React warnings.

- [ ] **Step 9: Wire the component into `App.tsx`**

Add imports:

```tsx
import { MessageComposer } from "./features/messaging/MessageComposer";
```

Inside `renderDashboard`, after `isHistoricalReadOnly`, derive only display-ready error copy:

```tsx
const deepSeekDisplayError = deepSeekError
  ? deepSeekError.includes("DEEPSEEK_API_KEY")
    ? "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。"
    : "DeepSeek 调用失败，请检查 API Key 或稍后重试。"
  : "";
```

Replace only the existing `shouldShowReplyBlock && selectedTask` reply-panel JSX with:

```tsx
{
  shouldShowReplyBlock && selectedTask && (
    <MessageComposer
      data={{
        creatorReply: currentCreatorReply(selectedTask),
        notes: selectedTask.notes,
        channel,
        chineseTranslation: deepSeekChineseTranslation,
        errorMessage: deepSeekDisplayError,
        message,
        messageSource,
        chineseExplanation: deepSeekChineseExplanation,
        trackingStatus,
        lastProcessingResult,
        hasNextTask: Boolean(nextTask),
      }}
      uiState={{
        historicalReadOnly: isHistoricalReadOnly,
        loadingAction: deepSeekLoadingAction,
        translationExpanded: isTranslationExpanded,
        translationEditing: isTranslationEditing,
        advancedReplyOpen: isAdvancedReplyOpen,
        replyFocus,
        relationshipNote: replyRelationshipNote,
        replyTone,
        replyGoal,
        replyConcession,
        showNextCreatorPrompt,
        messageOutputRef: messageAreaRef,
      }}
      actions={{
        updateCreatorReply: (value) =>
          updateCurrentCreatorReply(selectedTask, value),
        updateNotes: (value) => updateRow(selectedTask.id, "notes", value),
        generateDeepSeekReply: () =>
          void callDeepSeek("generate_personalized_reply"),
        translateCreatorReply: () =>
          void callDeepSeek("translate_creator_reply"),
        copyTranslation: () =>
          void copyText(deepSeekChineseTranslation, "已复制中文翻译。"),
        updateTranslation: setDeepSeekChineseTranslation,
        setTranslationExpanded: setIsTranslationExpanded,
        setTranslationEditing: setIsTranslationEditing,
        setReplyFocus,
        setReplyTone,
        setAdvancedReplyOpen: setIsAdvancedReplyOpen,
        setRelationshipNote: setReplyRelationshipNote,
        setReplyGoal,
        setReplyConcession,
        updateEnglishMessage: updateGeneratedEnglishMessage,
        copyEnglishMessage: () => void handleCopyGeneratedMessage(),
        markMessageSent: handleMarkMessageSent,
        markCreatorReplied: handleMarkCreatorReplied,
        markCreatorNoReply,
        markVideoProgress,
        updateVideoProgressManually: handleManualVideoProgressUpdate,
        markCreatorOutcome,
        markCreatorSkippedToday,
        processNextCreator: handleProcessNextCreator,
        stayOnCurrentCreator: () => setShowNextCreatorPrompt(false),
      }}
    />
  );
}
```

Do not change `shouldShowReplyBlock`, `selectedTask`, `isHistoricalReadOnly`, `messageAreaRef`, any handler implementation, or any state declaration/effect.

- [ ] **Step 10: Run focused integration safety nets**

Run under Node 22:

```bash
npm test -- src/App.test.tsx -t "shows a local recommended message|processes local-message tracking|only calls DeepSeek|uses DeepSeek output|personalized reply processing|DeepSeek optional reply buttons"
npm test -- src/App.test.tsx -t "clicking DeepSeek translate|clicking DeepSeek generate|DeepSeek API failure|records a creator reply|generates follow-up copy and marks a message as sent"
```

Expected: all selected tests PASS; fetch payloads, fallbacks, copy behavior, error copy, editing, tracking, and persistence remain unchanged.

- [ ] **Step 11: Run static checks and full suite**

```bash
npx tsc --noEmit --pretty false
npm test
git diff --check
```

Expected: typecheck passes, at least 188 tests pass (184 baseline + 4 focused), and no whitespace errors.

- [ ] **Step 12: Verify the ownership boundary**

```bash
rg -n "fetch|generateMessage|copyText|localStorage|setRows|setMessage|setMessageSource|finishProcessing|updateRow|saveCreatorRows|campaignToFilmingRequirements" src/features/messaging
rg -n "达人回复处理|reply-handling-panel" src/App.tsx src/features/messaging
git status --short
```

Expected: the feature directory contains none of the forbidden ownership calls/helpers; the moved heading/test id occur once in `MessageComposer.tsx`; changed files are exactly the three new feature files and `src/App.tsx`.

- [ ] **Step 13: Commit the complete extraction**

```bash
git add src/App.tsx src/features/messaging/messageComposerTypes.ts src/features/messaging/MessageComposer.tsx src/features/messaging/MessageComposer.test.tsx
git commit -m "Extract controlled message composer"
```

### Task 2: Verify Behavior Preservation and Prepare the Pull Request

**Files:**

- Verify: `src/App.tsx`
- Verify: `src/features/messaging/messageComposerTypes.ts`
- Verify: `src/features/messaging/MessageComposer.tsx`
- Verify: `src/features/messaging/MessageComposer.test.tsx`
- Preserve: `src/App.test.tsx`, API handlers, message generator, persistence modules.

**Interfaces:**

- Consumes: the reviewed controlled Message Composer from Task 1.
- Produces: a review-ready, independently revertible PR containing no API, tracking, persistence, or business change.

- [ ] **Step 1: Audit the focused diff**

```bash
git diff origin/main...HEAD --stat
git diff --check origin/main...HEAD
git diff origin/main...HEAD -- src/App.tsx src/features/messaging
```

Expected: only the App extraction and three feature files. No changes to API handlers, `messageGenerator.ts`, `campaignData.ts`, `creatorData.ts`, `sopRules.ts`, dependencies, storage keys, or existing integration tests.

- [ ] **Step 2: Confirm one render path and retained ownership**

```bash
rg -n "达人回复处理|reply-handling-panel|MessageComposer" src/App.tsx src/features/messaging
rg -n "fetch|generateMessage|copyText|setRows|finishProcessing|saveCreatorRows" src/features/messaging
```

Expected: one component implementation/render; no business/API/persistence ownership in the component.

- [ ] **Step 3: Run final Node.js 22 verification**

```bash
npm ci
npm test
npx tsc --noEmit --pretty false
npm run build
```

Expected: lockfile unchanged, at least 188 tests pass, typecheck passes, and production build passes.

- [ ] **Step 4: Manually verify invariants**

Confirm in the diff/tests:

- `shouldShowReplyBlock` and its selected-task condition are unchanged.
- Reply panel columns, labels, helper copy, button order, details blocks, and conditional output are unchanged.
- Historical mode disables exactly the same mutating actions.
- Both DeepSeek generate buttons call the same existing App handler; translate remains separate.
- Loading and API-key/general error copy are unchanged and classified in App.
- The existing `messageAreaRef` still points to `.message-output` for scroll behavior.
- Local messages, DeepSeek success/failure fallback, English editing, and copy use existing App handlers.
- Mark-sent/replied/no-reply/video/outcome/skip/next actions use existing App handlers and persistence effects.
- No API route, payload, storage, Campaign, priority, archive, or video-fulfillment code changed.

- [ ] **Step 5: Publish a separate PR without merging**

Push the clean branch and create:

```text
Title: Extract controlled Message Composer

Summary:
- move creator reply, translation, English editing, and tracking UI into a typed controlled component
- keep API calls, local fallback generation, state transitions, persistence, and queue operations in App
- add focused component tests while preserving existing message integration coverage

Behavior change: None
```

Do not start Dashboard extraction until this PR is reviewed, CI passes, and it is merged into `main`.
