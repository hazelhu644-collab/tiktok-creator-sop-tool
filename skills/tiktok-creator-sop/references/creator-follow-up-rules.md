# Creator Follow-up Rules

## Goal

Help TikTok Shop sellers answer: **Who should I follow up with today, and why?**

## Supported Creator Statuses

- To Contact
- Contacted
- In Communication / No Reply
- Sample Pending
- In Transit
- Delivered / Waiting for Video
- Followed Up
- Posted 1 Video / Waiting for 2nd Video
- Completed
- Failed

## Priority Rules

Apply priority rules in this order.

### Highest Priority

Highest applies when either:

1. The creator has replied and is waiting for operator handling; or
2. The product is Delivered, normalized video progress is `0/N`, and the delivery date is at least two natural days ago.

`N` is the current Campaign's positive required-video count. It has no fixed supported list or business upper limit. `Delivered`, 产品送到, and 已签收 have the same operational meaning, and delivery age is measured in natural days rather than exact 48-hour durations.

Reason: The creator has reopened the conversation, or the delivered product still has no posted video after the approved waiting period.

Suggested action: Handle the creator reply first, or send the first filming follow-up and remind the creator to follow the brief.

Priority precedence:

- Handled-today, archived, completed, and failed records do not enter today's pending queue.
- A pending creator reply overrides pause notes and future follow-up dates.
- Without a pending reply, a pause note or future follow-up date suppresses automatic delivered-age Highest.
- Delivered with a missing or invalid delivery date is High. Show `已送达，但缺少到货日期。` and suggest `补充到货日期并确认拍摄计划。`

### High Priority

Conditions:

- Normalized video progress is `X/N`, where `0 < X < N`.
- First video posted date is not empty.

Reason: The creator has posted only part of the required video commitment.

Suggested action: Ask the creator to post the remaining required videos.

### Medium Priority

Conditions:

- Current status is Followed Up.
- Last contact date is at least 1 day ago.
- Video progress is incomplete.

Reason: The seller already followed up, but the creator has not replied or completed the collaboration.

Suggested action: Send a second follow-up.

### Low Priority

Conditions:

- Current status is Contacted.
- Last contact date is at least 2 days ago.
- Sample shipping status is empty, Pending, or Not Shipped.

Reason: The seller contacted the creator, but the creator has not replied yet.

Suggested action: Send a light follow-up.

## Failed Candidate Warnings

Never automatically mark a creator as Failed. Only suggest “Failed Candidate” when one or more conditions match:

1. Sample shipping status is Delivered, video progress is `0/N`, and sample delivered date is at least 7 natural days ago. Keep the task Highest and also show the warning.
2. Last follow-up count is 2 or more, and the creator still has not replied or completed the collaboration.
3. Video progress is `1/2`, and first video posted date is at least 5 days ago.
4. Notes suggest long-time no reply, no filming plan, bad cooperation, or unwillingness to correct the video.

Offer final user-controlled actions:

- Continue following up.
- Mark as failed.
- Wait and review later.

## Highest Priority Explanation

For every Highest Priority creator, explain:

- Creator username.
- Sample delivery timing.
- Current video progress.
- Why this creator is urgent.
- Suggested next action.
