# Highest Priority Rule Design

## Status

Approved in discussion on 2026-08-04. This document defines a focused business-rule correction. It does not include the `App.tsx` component extraction work.

## Goal

Restore `Highest` as a real, operator-visible priority that answers: **Who must be handled first today?**

Keep action priority separate from collaboration risk:

- `Highest` means the task should be handled first today.
- `Failed Candidate` means the collaboration has warning signals and needs an operator decision.
- The system never marks a creator as `Failed` automatically.

## Dynamic Video Target

All progress rules use the current Campaign's configured required-video count `N`.

- `N` may be any positive integer. The rule must not contain a fixed list or an upper business limit.
- `0/N` means no required videos have been posted.
- `X/N`, where `0 < X < N`, means partial completion.
- `X >= N` means the video obligation is complete.
- Over-delivery is preserved as the actual posted count and is not capped to `N`.
- Rule evaluation uses normalized numeric progress, not a literal comparison with `"0/2"`.

If a valid positive required-video count cannot be obtained, the existing normalization fallback remains responsible for producing a usable value. This change does not introduce a new Campaign validation system.

## Delivered Meaning

For this workflow, `Delivered`, “产品送到”, and “已签收” have the same operational meaning: the creator has received the product.

Delivered evidence may come from either the logistics status or a current collaboration status that explicitly means delivered or waiting for video. A delivery date is still required to determine whether two natural days have elapsed.

## Priority Evaluation Order

Evaluate creators in the following order. An earlier rule takes precedence over later rules.

1. **Non-actionable records**
   - Archived, completed, and failed collaborations do not enter today's pending queue.
2. **Handled today**
   - A creator already processed today moves to the processed-today area and is not shown again in today's pending queue.
3. **Creator reply waiting for handling**
   - A creator reply that still needs an operator response is `Highest`.
   - This rule overrides a previous pause note or future follow-up date because the creator has re-opened the conversation.
4. **Explicit operator pause**
   - A “do not follow up for now” note or a future next-follow-up date suppresses the automatic delivered-age `Highest` rule.
5. **Delivered with no posted videos for two natural days**
   - Delivered evidence exists.
   - Normalized posted count is `0` against the current positive required count `N`.
   - The delivery date is at least two natural days before today.
   - The task is `Highest`.
6. **Delivered but delivery date missing**
   - The task is `High`, not `Highest`.
   - Reason: `已送达，但缺少到货日期。`
   - Suggested action: `补充到货日期并确认拍摄计划。`
7. **Partial video completion**
   - A normalized posted count greater than `0` and less than `N` remains `High`.
8. **Other actionable conditions**
   - Due follow-ups, repeated incomplete follow-ups, logistics exceptions, invitations, and review tasks continue through the existing High, Medium, and Low rules unless separately redesigned.

## Natural-Day Calculation

The delivered-age threshold uses calendar days because the spreadsheet stores dates rather than exact delivery timestamps.

Example:

- Delivered on August 1.
- August 2 is one natural day later.
- On August 3, two natural days have elapsed and the creator becomes `Highest` if video progress remains `0/N`.

The system does not require an exact 48-hour duration.

## Highest Ordering

Within the `Highest` group, sort deterministically:

1. Creator replies waiting for handling.
2. Delivered `0/N` tasks, with older delivery dates first.
3. When delivery dates are equal, higher follow-up counts first.
4. Finally, creator username in stable lexical order.

This ordering applies after non-actionable and handled-today records have been removed from the pending queue.

## Failed Candidate Interaction

When a product has been delivered for at least seven natural days and video progress remains `0/N`:

- Keep the task at `Highest`.
- Add the existing Failed Candidate warning.
- Offer the operator the existing choices to continue following up, wait and review later, or mark the collaboration as failed.
- Do not change the collaboration status automatically.

Other existing Failed Candidate signals remain unchanged unless separately redesigned.

## Processing Behavior

The following actions count as handled today and remove the creator from today's pending queue:

- Sending or recording a message.
- Recording the result of handling a creator reply.
- Recording no reply.
- Skipping the creator for today.
- Completing or failing the collaboration.

The creator remains available in the processed-today area. On the next natural day, the system recalculates priority from the latest status, progress, delivery date, follow-up date, pause state, and history.

## UI Behavior

- Render `Highest` as `最高`; never fall through to the Low label.
- Restore the highest-priority count in the daily summary.
- Allow the queue to be filtered by Highest, High, Medium, and Low.
- Show an explicit reason and suggested action for every Highest creator.
- Use these primary reason patterns:
  - `达人已回复，等待处理。`
  - `产品已送达 X 天，视频进度仍为 0/N。`
- For delivered records without a delivery date, show the High reason and suggested action defined above.
- Show Failed Candidate as a separate warning alongside the priority; do not replace the priority label with the warning.
- Preserve the existing navigation and page layout. This correction does not add a hidden score or redesign the dashboard.

## Implementation Boundary

Implement this as a standalone business correction before component extraction.

Expected files:

- `src/sopRules.ts`: priority evaluation, reasons, ordering, and summary.
- `src/App.tsx`: labels, filters, summary, and reason presentation.
- `src/sopRules.test.ts`: domain behavior and ordering coverage.
- `src/App.test.tsx`: summary, filters, labels, and processed-today integration coverage.
- Product-rule documentation and the repository skill reference, only where needed to keep the approved behavior consistent.

Do not combine this work with page extraction, state-management changes, persistence-schema changes, API changes, or unrelated cleanup.

## Verification Requirements

Tests must cover:

1. A pending creator reply becomes `Highest`.
2. Pending replies sort before delivered `0/N` tasks.
3. Delivered `0/N` becomes `Highest` after two natural days for arbitrary positive `N`.
4. Delivered `0/N` does not become `Highest` before two natural days.
5. Delivered with no delivery date is `High` and shows the approved missing-date reason and action.
6. An explicit pause or future follow-up date suppresses automatic delivered-age `Highest`.
7. A new creator reply overrides the pause and becomes `Highest`.
8. Delivered for at least seven days with `0/N` is both `Highest` and a Failed Candidate.
9. Processing a Highest task removes it from today's pending queue.
10. The next natural day recalculates the creator from current data.
11. Highest summary count, filter, Chinese label, reason, and action render correctly.
12. Partial completion remains correct for arbitrary `X/N` where `0 < X < N`.
13. `X >= N` is complete and over-delivery is not truncated.

Use representative values of `N` in tests, but do not implement or imply a fixed supported list. The existing test count is a floor; no existing test may be removed or skipped to make the change pass.

Required verification:

```bash
npm test
npx tsc --noEmit --pretty false
npm run build
```

Node.js 22 CI is the formal acceptance environment. Local checks on another compatible Node version are supplementary and do not replace the CI result.

## Acceptance Criteria

- `Highest` is produced by the two approved triggers and is visible throughout the UI.
- Highest ordering matches the approved deterministic order.
- Operator pauses, creator replies, missing dates, handled-today behavior, and seven-day risk warnings interact exactly as specified.
- Video requirements remain fully dynamic for any positive integer `N`.
- Failed Candidate remains advisory and user-controlled.
- Existing persistence keys, schemas, API behavior, and unrelated priority behavior remain unchanged.
- All existing and new tests pass under the required Node.js 22 CI environment.
