# Highest Priority Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `Highest` as the visible “must handle first today” priority for pending creator replies and products delivered for at least two natural days with zero posted videos.

**Architecture:** Keep priority evaluation and deterministic ordering in `src/sopRules.ts`, and expose one shared task comparator so `App.tsx` cannot accidentally undo the domain ordering after analyzing creators one row at a time. Keep UI changes limited to labels, filtering, an inline daily Highest count, reasons, and actions; do not combine this correction with component extraction.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest 4, Testing Library, jsdom, Node.js 22 CI.

## Global Constraints

- Implement this as a standalone business correction before component extraction.
- `Highest` means the task must be handled first today; `Failed Candidate` remains a separate advisory warning.
- Never automatically mark a creator as `Failed`.
- Treat `Delivered`, “产品送到”, and “已签收” as the same operational state.
- Calculate delivery age by natural days, not exact 48-hour durations.
- Support any positive integer Campaign requirement `N`; never compare priority rules to a literal `"0/2"` or impose a fixed supported list.
- Preserve actual over-delivery counts; `X >= N` is complete and must not be capped to `N`.
- A pending creator reply overrides a pause note or future follow-up date, but handled-today, archived, completed, and failed records stay out of today's pending queue.
- An explicit pause or future follow-up date suppresses automatic delivered-age Highest when there is no new pending creator reply.
- Delivered with a missing or invalid delivery date is `High` with reason `已送达，但缺少到货日期。` and action `补充到货日期并确认拍摄计划。`
- Delivered for at least seven natural days with `0/N` remains `Highest` and also receives the existing Failed Candidate warning.
- Do not change localStorage keys, schemas, persistence timing, APIs, navigation, layout, dependencies, or unrelated priority behavior.
- Do not remove or skip existing tests; the existing 176 tests are the floor before new tests are added.
- Formal acceptance runs under Node.js 22 CI and includes tests, type checking, and the production build.

---

## File Map

- Modify `src/sopRules.ts`: assign Highest, preserve operator overrides, produce approved copy, export the canonical comparator, and count Highest in summaries.
- Modify `src/sopRules.test.ts`: cover triggers, precedence, arbitrary positive `N`, natural-day boundaries, missing dates, failure warnings, handled-today behavior, and deterministic ordering.
- Modify `src/App.tsx`: render Highest correctly, include it in urgency state/filter/search, reuse the canonical comparator, and show an inline Highest count in the queue header.
- Modify `src/App.test.tsx`: verify the Highest label, count, filter, approved reasons/actions, ordering, and processed-today behavior through the UI.
- Modify `README.md`, `docs/mvp-rules.md`, `skills/tiktok-creator-sop/references/creator-follow-up-rules.md`: align the product documentation with the approved two-trigger Highest behavior and dynamic `0/N` terminology.
- Preserve `docs/superpowers/specs/2026-08-04-highest-priority-rule-design.md` as the approved source of truth.

---

### Task 1: Implement Highest Triggers and Precedence

**Files:**

- Modify: `src/sopRules.test.ts:101-269`
- Modify: `src/sopRules.ts:1-4, 245-421`

**Interfaces:**

- Consumes: `analyzeCreator(row: CreatorRow, today?: Date, requiredVideos?: number): Task`, existing normalized `postedCount`, `daysSince`, pause detection, handled-today detection, and delivery evidence.
- Produces: `Task.priority === "Highest"` for the two approved triggers, with approved `triggerReason` and `suggestedAction` copy.

- [ ] **Step 1: Update the existing baseline expectations before adding new cases**

In `src/sopRules.test.ts`, change the default priority test so the delivered creator is expected to be Highest and the summary expectation reflects one Highest:

```ts
expect(tasks.map((task) => task.priority)).toEqual([
  "Highest",
  "High",
  "Medium",
  "Low",
]);
expect(buildSummary(tasks)).toMatchObject({
  totalCreators: 4,
  needsFollowUp: 4,
  highest: 1,
  high: 1,
  medium: 1,
  low: 1,
});
```

In the parameterized required-video test, change the delivered zero-progress expectation to:

```ts
expect(
  tasks.find((task) => task.id === `zero-${requiredVideos}`)?.priority,
).toBe("Highest");
```

- [ ] **Step 2: Add failing tests for the two Highest triggers**

Add these focused tests inside `describe('MVP SOP rules', ...)`:

```ts
it.each([1, 3, 11, 97])(
  "marks delivered zero-progress work Highest for arbitrary requiredVideos=%i",
  (requiredVideos) => {
    const [task] = analyzeCreators(
      [
        row({
          sampleShippingStatus: "Delivered",
          sampleDeliveredDate: "2026-06-03",
          videoProgress: `0 of ${requiredVideos}`,
        }),
      ],
      today,
      requiredVideos,
    );

    expect(task).toMatchObject({
      priority: "Highest",
      videoProgress: `0/${requiredVideos}`,
      suggestedAction: `发送拍摄跟进，提醒达人按照达人拍摄要求完成 ${requiredVideos} 条视频。`,
    });
    expect(task.triggerReason).toContain("产品已送达 2 天");
    expect(task.triggerReason).toContain(`0/${requiredVideos}`);
  },
);

it("marks an unhandled pending creator reply Highest", () => {
  const [task] = analyzeCreators(
    [
      row({
        trackingStatus: "Reply Pending",
        lastCreatorResponse: "Can I post on Friday?",
        notes: "暂不催",
        nextFollowUpDate: "2026-06-20",
      }),
    ],
    today,
    2,
  );

  expect(task).toMatchObject({
    priority: "Highest",
    triggerReason: "达人已回复，等待处理。",
  });
  expect(task.suggestedAction).toContain("回复达人消息");
});
```

- [ ] **Step 3: Add failing precedence and boundary tests**

```ts
it("uses natural-day boundaries and keeps recent delivery High", () => {
  const tasks = analyzeCreators(
    [
      row({
        id: "one-day",
        username: "one-day",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-04",
        videoProgress: "0/8",
      }),
      row({
        id: "two-days",
        username: "two-days",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-03",
        videoProgress: "0/8",
      }),
    ],
    today,
    8,
  );

  expect(tasks.find((task) => task.id === "one-day")?.priority).toBe("High");
  expect(tasks.find((task) => task.id === "two-days")?.priority).toBe(
    "Highest",
  );
});

it("keeps missing or invalid delivered dates High with approved operator copy", () => {
  for (const sampleDeliveredDate of ["", "not-a-date"]) {
    const [task] = analyzeCreators(
      [
        row({
          sampleShippingStatus: "Delivered",
          sampleDeliveredDate,
          videoProgress: "0/6",
        }),
      ],
      today,
      6,
    );

    expect(task).toMatchObject({
      priority: "High",
      triggerReason: "已送达，但缺少到货日期。",
      suggestedAction: "补充到货日期并确认拍摄计划。",
    });
  }
});

it("lets operator pause suppress delivered-age Highest but not a pending reply", () => {
  const tasks = analyzeCreators(
    [
      row({
        id: "paused-delivery",
        username: "paused-delivery",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-01",
        notes: "暂不催",
      }),
      row({
        id: "future-delivery",
        username: "future-delivery",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-01",
        nextFollowUpDate: "2026-06-08",
      }),
      row({
        id: "reply",
        username: "reply",
        trackingStatus: "Reply Pending",
        lastCreatorResponse: "Friday works.",
        notes: "暂不催",
        nextFollowUpDate: "2026-06-08",
      }),
    ],
    today,
    2,
  );

  expect(tasks.find((task) => task.id === "paused-delivery")?.priority).toBe(
    "Low",
  );
  expect(tasks.find((task) => task.id === "future-delivery")?.priority).toBe(
    "Low",
  );
  expect(tasks.find((task) => task.id === "reply")?.priority).toBe("Highest");
});
```

- [ ] **Step 4: Run the focused domain tests and confirm RED**

Run:

```bash
npx vitest run src/sopRules.test.ts --reporter=verbose
```

Expected: failures show delivered and pending-reply tasks still returning `High`, the missing-date copy is absent, and `highest` remains zero.

- [ ] **Step 5: Implement the minimal priority changes**

In `src/sopRules.ts`:

1. Give Highest a distinct rank:

```ts
export const PRIORITY_RANK: Record<Priority, number> = {
  Highest: 0,
  High: 1,
  Medium: 3,
  Low: 4,
  None: 99,
};
```

2. Keep archived/completed/failed/handled-today checks first.
3. Move `hasPendingCreatorReply` before the pause/future-follow-up branch and return approved Highest copy:

```ts
} else if (hasPendingCreatorReply) {
  priority = 'Highest';
  triggerReason = '达人已回复，等待处理。';
  suggestedAction = '生成「回复达人消息」话术，基于达人回复内容给出下一步回应。';
} else if ((pauseNote || futureFollowUp) && !dueFollowUp && !isShippedOrInTransit(row)) {
```

4. Replace the current delivered-zero branch with numeric dynamic progress and natural-day handling:

```ts
} else if (hasDeliveredEvidence(row) && progress.postedCount === 0) {
  if (deliveredDays === null) {
    priority = 'High';
    triggerReason = '已送达，但缺少到货日期。';
    suggestedAction = '补充到货日期并确认拍摄计划。';
  } else if (deliveredDays >= 2) {
    priority = 'Highest';
    triggerReason = `产品已送达 ${deliveredDays} 天，视频进度仍为 0/${requiredVideos}。`;
    suggestedAction = `发送拍摄跟进，提醒达人按照达人拍摄要求完成 ${requiredVideos} 条视频。`;
  } else {
    priority = 'High';
    triggerReason = '产品近期送达，需确认拍摄计划。';
    suggestedAction = '轻提醒达人确认收货和预计发布时间。';
  }
```

Do not compare `row.videoProgress` to a literal progress string.

- [ ] **Step 6: Run the focused test and confirm GREEN**

Run:

```bash
npx vitest run src/sopRules.test.ts --reporter=verbose
```

Expected: all `src/sopRules.test.ts` tests pass.

- [ ] **Step 7: Commit the domain trigger change**

```bash
git add src/sopRules.ts src/sopRules.test.ts
git commit -m "Fix Highest priority triggers"
```

---

### Task 2: Canonicalize Highest Ordering and Summary Counts

**Files:**

- Modify: `src/sopRules.test.ts:101-290`
- Modify: `src/sopRules.ts:286-445`

**Interfaces:**

- Consumes: fully analyzed `Task` values with `stageRank`, `priorityRank`, delivery date, follow-up count, and username.
- Produces: `compareTasks(a: Task, b: Task, today?: Date): number`, reused by both `analyzeCreators` and the application.

- [ ] **Step 1: Write a failing deterministic-order test**

```ts
it("sorts Highest replies first, then older delivery, follow-up count, and username", () => {
  const tasks = analyzeCreators(
    [
      row({
        id: "delivery-b",
        username: "bravo",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-01",
        lastFollowUpCount: 1,
      }),
      row({
        id: "reply-z",
        username: "zulu",
        trackingStatus: "Reply Pending",
        lastCreatorResponse: "Reply",
      }),
      row({
        id: "delivery-a",
        username: "alpha",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-01",
        lastFollowUpCount: 1,
      }),
      row({
        id: "reply-a",
        username: "alpha-reply",
        trackingStatus: "Reply Pending",
        lastCreatorResponse: "Reply",
      }),
      row({
        id: "delivery-followups",
        username: "charlie",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-01",
        lastFollowUpCount: 3,
      }),
      row({
        id: "delivery-newer",
        username: "newer",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-02",
        lastFollowUpCount: 9,
      }),
    ],
    today,
    2,
  );

  expect(tasks.map((task) => task.id)).toEqual([
    "reply-a",
    "reply-z",
    "delivery-followups",
    "delivery-a",
    "delivery-b",
    "delivery-newer",
  ]);
});
```

- [ ] **Step 2: Write a failing seven-day warning and summary test**

```ts
it("keeps seven-day zero-progress work Highest and separately warns Failed Candidate", () => {
  const [task] = analyzeCreators(
    [
      row({
        currentStatus: "Delivered / Waiting for Video",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-28",
        videoProgress: "0/13",
      }),
    ],
    today,
    13,
  );

  expect(task.priority).toBe("Highest");
  expect(task.failedWarnings[0]).toContain("样品已到货 8 天");
  expect(task.currentStatus).toBe("Delivered / Waiting for Video");
  expect(buildSummary([task])).toMatchObject({ highest: 1, high: 0 });
});
```

- [ ] **Step 3: Run the two tests and confirm RED**

Run:

```bash
npx vitest run src/sopRules.test.ts --reporter=verbose
```

Expected: ordering differs and/or `buildSummary` still reports `highest: 0`.

- [ ] **Step 4: Export and use one canonical comparator**

Add this interface and ordering shape to `src/sopRules.ts`:

```ts
export function compareTasks(a: Task, b: Task, today = new Date()): number {
  const stageOrder = a.stageRank - b.stageRank;
  if (stageOrder !== 0) return stageOrder;

  const priorityOrder = a.priorityRank - b.priorityRank;
  if (priorityOrder !== 0) return priorityOrder;

  if (a.priority === "Highest" && b.priority === "Highest") {
    if (a.stageRank === 2 && b.stageRank === 2) {
      const aDeliveredDays = daysSince(a.sampleDeliveredDate, today) ?? -1;
      const bDeliveredDays = daysSince(b.sampleDeliveredDate, today) ?? -1;
      const deliveredOrder = bDeliveredDays - aDeliveredDays;
      if (deliveredOrder !== 0) return deliveredOrder;

      const followUpOrder = b.lastFollowUpCount - a.lastFollowUpCount;
      if (followUpOrder !== 0) return followUpOrder;
    }
    return a.username.localeCompare(b.username);
  }

  if (a.stageRank === 5 && b.stageRank === 5) {
    const arrivalOrder =
      (arrivalDateDeltaDays(a.sampleDeliveredDate, today) ??
        Number.POSITIVE_INFINITY) -
      (arrivalDateDeltaDays(b.sampleDeliveredDate, today) ??
        Number.POSITIVE_INFINITY);
    if (arrivalOrder !== 0) return arrivalOrder;
  }

  return (
    (daysSince(b.lastContactDate, today) ?? -1) -
      (daysSince(a.lastContactDate, today) ?? -1) ||
    b.lastFollowUpCount - a.lastFollowUpCount ||
    (parseDate(a.nextFollowUpDate ?? "")?.getTime() ??
      Number.POSITIVE_INFINITY) -
      (parseDate(b.nextFollowUpDate ?? "")?.getTime() ??
        Number.POSITIVE_INFINITY) ||
    a.username.localeCompare(b.username)
  );
}
```

Replace the inline sort in `analyzeCreators` with:

```ts
.sort((a, b) => compareTasks(a, b, today));
```

Update `buildSummary`:

```ts
highest: tasks.filter((task) => task.priority === 'Highest').length,
```

- [ ] **Step 5: Run domain tests and confirm GREEN**

```bash
npx vitest run src/sopRules.test.ts --reporter=verbose
```

Expected: all domain tests pass, including exact Highest order and seven-day warning independence.

- [ ] **Step 6: Commit the ordering contract**

```bash
git add src/sopRules.ts src/sopRules.test.ts
git commit -m "Add deterministic Highest priority ordering"
```

---

### Task 3: Expose Highest in the Workbench UI

**Files:**

- Modify: `src/App.test.tsx:1-220, 1280-1720`
- Modify: `src/App.tsx:1-65, 275-297, 669-672, 824-1015, 2794-3100`

**Interfaces:**

- Consumes: `compareTasks`, analyzed `Task.priority`, `Task.triggerReason`, and `Task.suggestedAction`.
- Produces: visible `最高` labels, a Highest urgency filter, an inline `最高优先级 N` count, and canonical ordering in every active queue sort.

- [ ] **Step 1: Add a failing UI test for label, count, reason, action, and filter**

Freeze the UI date and seed one pending reply, one aged delivery, and one High missing-date record:

```tsx
it("shows and filters Highest work with approved reasons and actions", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-05T12:00:00Z"));
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  seedCreators([
    creatorRow({
      id: "reply",
      username: "reply_creator",
      trackingStatus: "Reply Pending",
      lastCreatorResponse: "Friday works.",
      sampleShippingStatus: "",
      sampleDeliveredDate: "",
    }),
    creatorRow({
      id: "aged",
      username: "aged_creator",
      sampleDeliveredDate: "2026-06-03",
      videoProgress: "0 of 2",
    }),
    creatorRow({
      id: "missing-date",
      username: "missing_date_creator",
      sampleDeliveredDate: "",
      videoProgress: "0 of 2",
    }),
  ]);

  render(<App />);
  await goTo(user, /达人跟进中心/);

  expect(screen.getByText(/最高优先级 2/)).toBeInTheDocument();
  expect(screen.getByTestId("creator-queue").textContent).toMatch(
    /reply_creator[\s\S]*aged_creator/,
  );
  expect(screen.getByTestId("creator-queue")).toHaveTextContent("最高");

  await user.selectOptions(screen.getByLabelText("紧急程度"), "Highest");
  expect(screen.getByTestId("creator-queue")).toHaveTextContent(
    "reply_creator",
  );
  expect(screen.getByTestId("creator-queue")).toHaveTextContent("aged_creator");
  expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
    "missing_date_creator",
  );

  await user.selectOptions(screen.getByLabelText("选择达人"), "aged");
  expect(
    screen.getByText("产品已送达 2 天，视频进度仍为 0/2。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("发送拍摄跟进，提醒达人按照达人拍摄要求完成 2 条视频。"),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a failing UI test for missing delivery date**

```tsx
it("keeps delivered work without a delivery date High and asks for the date", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-05T12:00:00Z"));
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  seedCreators([
    creatorRow({
      id: "missing-date",
      username: "missing_date_creator",
      sampleDeliveredDate: "",
      videoProgress: "0 of 9",
    }),
  ]);

  render(<App />);
  await goTo(user, /达人跟进中心/);

  expect(screen.getByTestId("creator-queue")).toHaveTextContent("高");
  expect(screen.getByText("已送达，但缺少到货日期。")).toBeInTheDocument();
  expect(screen.getByText("补充到货日期并确认拍摄计划。")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the new App tests and confirm RED**

Run the new tests by their names:

```bash
npx vitest run src/App.test.tsx -t "shows and filters Highest|keeps delivered work without" --reporter=verbose
```

Expected: Highest is absent from state/filter/labels, the count is absent, and existing post-analysis sorting may not preserve exact ordering.

- [ ] **Step 4: Wire Highest through UI state, labels, search, and sorting**

In `src/App.tsx`:

1. Import `compareTasks` from `./sopRules`.
2. Update urgency state:

```ts
const [followupUrgency, setFollowupUrgency] = useState<
  "All" | "Highest" | "High" | "Medium" | "Low"
>("All");
```

3. Update the shared label:

```ts
function priorityLabel(task: Task): string {
  return task.priority === "Highest"
    ? "最高"
    : task.priority === "High"
      ? "高"
      : task.priority === "Medium"
        ? "中"
        : "低";
}
```

4. Treat Highest as pending in `queueStatusLabelText` and include `最高` in the search urgency label.
5. Add `<option value="Highest">最高</option>` before High.
6. Replace both active queue sorts that currently compare only `stageRank` and `priorityRank` with:

```ts
.sort((a, b) => compareTasks(a, b));
```

This includes the `tasks` memo after per-row analysis and `filteredTasks`.

- [ ] **Step 5: Add the inline Highest daily summary without changing dashboard cards**

Derive the pending count from the current workbench source:

```ts
const highestPendingCount = workbenchTasks.filter(
  (task) => task.priority === "Highest" && !isHandledToday(task),
).length;
```

Render it in the “今日待处理达人队列” section heading, near the existing muted queue description:

```tsx
<p className="muted">最高优先级 {highestPendingCount}</p>
```

Do not add a ninth dashboard metric card and do not redesign the page.

- [ ] **Step 6: Run the focused UI tests and confirm GREEN**

```bash
npx vitest run src/App.test.tsx -t "shows and filters Highest|keeps delivered work without" --reporter=verbose
```

Expected: both focused tests pass.

- [ ] **Step 7: Add or update the processed-today integration assertion**

Extend the existing “generates follow-up copy and marks a message as sent” or processed-today test so its seeded task starts as Highest. After the send/processing action, assert:

```tsx
expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
  "aged_creator",
);
await user.click(screen.getByLabelText("显示今日已处理"));
expect(screen.getByTestId("creator-queue")).toHaveTextContent("aged_creator");
expect(screen.getByTestId("creator-queue")).toHaveTextContent("今日已处理");
```

Use the existing test's actual creator id/name and action button rather than duplicating its entire workflow.

- [ ] **Step 8: Run the complete App integration file**

```bash
npx vitest run src/App.test.tsx --reporter=dot
```

Expected: every App test passes; no existing dashboard card, navigation, message, archive, or Campaign assertion changes except intentional Highest expectations.

- [ ] **Step 9: Commit the UI integration**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "Show Highest priority in workbench"
```

---

### Task 4: Synchronize Product Rules and Skill Reference

**Files:**

- Modify: `README.md:135-174`
- Modify: `docs/mvp-rules.md:45-170`
- Modify: `skills/tiktok-creator-sop/references/creator-follow-up-rules.md:20-95`

**Interfaces:**

- Consumes: approved behavior in `docs/superpowers/specs/2026-08-04-highest-priority-rule-design.md`.
- Produces: one consistent human-readable rule contract for future maintainers and Codex sessions.

- [ ] **Step 1: Replace fixed `0/2` Highest wording with dynamic `0/N` wording**

State exactly:

```markdown
Highest applies when either:

1. The creator has replied and is waiting for operator handling; or
2. The product is Delivered, normalized video progress is `0/N`, and the delivery date is at least two natural days ago.

`N` is the current Campaign's positive required-video count and has no fixed supported list or business upper limit.
```

- [ ] **Step 2: Document precedence and edge behavior**

Include these exact operational decisions in both rule references and summarize them in README:

- Handled-today, archived, completed, and failed work does not enter today's pending queue.
- Pending creator replies override pauses and future follow-up dates.
- Pauses and future follow-up dates suppress automatic delivered-age Highest when no reply is waiting.
- Delivered without a valid delivery date is High with the approved reason/action.
- Delivered for at least seven natural days with `0/N` is both Highest and a Failed Candidate.
- Failed Candidate never changes status automatically.

- [ ] **Step 3: Scan for contradictory fixed priority copy**

Run:

```bash
rg -n "Highest|最高优先级|0/2|at least 2 days|至少 2 天|两天" README.md docs/mvp-rules.md skills/tiktok-creator-sop/references/creator-follow-up-rules.md
```

Expected: every remaining `0/2` mention is clearly an input example rather than the Highest implementation rule; all Highest definitions contain both approved triggers.

- [ ] **Step 4: Commit the documentation alignment**

```bash
git add README.md docs/mvp-rules.md skills/tiktok-creator-sop/references/creator-follow-up-rules.md
git commit -m "Align Highest priority documentation"
```

---

### Task 5: Run Full Regression and Acceptance Verification

**Files:**

- Verify: `src/sopRules.ts`
- Verify: `src/sopRules.test.ts`
- Verify: `src/App.tsx`
- Verify: `src/App.test.tsx`
- Verify: updated product-rule documentation

**Interfaces:**

- Consumes: completed Tasks 1-4.
- Produces: evidence that the focused rule correction passes the full repository safety net without entering component-refactor scope.

- [ ] **Step 1: Run the full test suite under Node.js 22**

```bash
npm test
```

Expected: all test files pass; total test count is greater than 176 because new tests were added.

- [ ] **Step 2: Run standalone type checking**

```bash
npx tsc --noEmit --pretty false
```

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: exit code 0 and Vite emits the production bundles.

- [ ] **Step 4: Verify the final diff is focused**

```bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: no whitespace errors; only the rule, tests, UI exposure, and documentation files listed in this plan changed. There are no new dependencies, localStorage migrations, API edits, or feature component extractions.

- [ ] **Step 5: Review acceptance cases against the approved spec**

Confirm from tests and code:

- Both Highest triggers work.
- Replies sort before delivered zero-progress tasks.
- Older delivery, follow-up count, and username tie-breakers are deterministic.
- Arbitrary positive `N` is numeric and dynamic.
- Natural-day threshold, missing dates, pauses, handled-today, and seven-day warning behavior match the spec.
- Highest count, label, filter, reason, and action are visible.
- Failed Candidate is still advisory.

If any item is not demonstrated by an automated test, add the missing focused test before completion.

- [ ] **Step 6: Commit only if verification required a corrective change**

If verification exposed and fixed a defect, commit only that focused correction:

```bash
git add src/sopRules.ts src/sopRules.test.ts src/App.tsx src/App.test.tsx README.md docs/mvp-rules.md skills/tiktok-creator-sop/references/creator-follow-up-rules.md
git commit -m "Fix Highest priority regression"
```

If no corrective change was needed, do not create an empty commit.
