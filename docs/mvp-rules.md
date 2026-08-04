> [!IMPORTANT]
> **Historical MVP rules**
>
> These rules document an earlier MVP design and are retained for historical reference. Actual runtime behavior is defined by [`src/sopRules.ts`](../src/sopRules.ts) and the current automated tests.
>
> Do not treat this file as the authoritative specification for current business rules.

# MVP Logic Rules

## Goal

The MVP should help TikTok Shop sellers upload a creator collaboration spreadsheet and generate a daily follow-up task list.

The system should not try to manage everything. It should focus on answering one question:

Who should the seller follow up with today, and why?

## Required Spreadsheet Columns

The uploaded CSV or Excel file should include these columns:

* Creator username
* Creator profile link
* Contact method
* Product
* Current status
* Sample shipping status
* Sample delivered date
* Video progress
* First video posted date
* Last contact date
* Last follow-up count
* Notes

## Supported Creator Statuses

Use these status options:

* To Contact
* Contacted
* In Communication / No Reply
* Sample Pending
* In Transit
* Delivered / Waiting for Video
* Followed Up
* Posted 1 Video / Waiting for 2nd Video
* Completed
* Failed

## Video Progress Format

Video progress should use `X/N`, where `N` is the current Campaign's positive required-video count.

* `N` may be any positive integer, without a fixed supported list or business upper limit.
* `0/N` means no required videos have been posted.
* `0 < X < N` means partial completion.
* `X >= N` means complete; over-delivery remains recorded and is not capped.

## Priority Rules

The system should calculate task priority in this order:

### Highest Priority

Highest applies when either:

1. The creator has replied and is waiting for operator handling; or
2. The product is Delivered, normalized video progress is `0/N`, and the delivery date is at least two natural days ago.

`Delivered`, 产品送到, and 已签收 have the same operational meaning. Calendar-day differences are used; the system does not require an exact 48-hour duration.

Reason:

The creator has reopened the conversation, or the delivered product still has no posted video after the approved waiting period.

Suggested action:

Handle the creator reply first, or send the first filming follow-up and remind the creator to follow the brief.

### Priority Precedence

* Handled-today, archived, completed, and failed records do not enter today's pending queue.
* A pending creator reply overrides pause notes and future follow-up dates.
* Without a pending reply, a pause note or future follow-up date suppresses automatic delivered-age Highest.
* Delivered with a missing or invalid delivery date is High. Show `已送达，但缺少到货日期。` and suggest `补充到货日期并确认拍摄计划。`

### High Priority

Condition:

* Normalized video progress is `X/N`, where `0 < X < N`
* First video posted date is not empty

Reason:

The creator has posted only part of the required video commitment.

Suggested action:

Ask the creator to post the remaining required videos.

### Medium Priority

Condition:

* Current status is Followed Up
* Last contact date is at least 1 day ago
* Video progress is incomplete

Reason:

The seller already followed up, but the creator has not replied or completed the collaboration.

Suggested action:

Send a second follow-up.

### Low Priority

Condition:

* Current status is Contacted
* Last contact date is at least 2 days ago
* Sample shipping status is empty, Pending, or Not Shipped

Reason:

The seller contacted the creator, but the creator has not replied yet.

Suggested action:

Send a light follow-up.

## Failed Candidate Rules

The system should not automatically mark creators as Failed.

It should only suggest “Failed Candidate” when one of these conditions is met:

### Rule 1

Sample shipping status is Delivered, video progress is `0/N`, and sample delivered date is at least 7 natural days ago. The task remains Highest while also showing the Failed Candidate warning.

### Rule 2

Last follow-up count is 2 or more, and the creator still has not replied or completed the collaboration.

### Rule 3

Video progress is 1/2, and first video posted date is at least 5 days ago.

### Rule 4

Notes suggest long-time no reply, no filming plan, bad cooperation, or unwillingness to correct the video.

The user should choose one of these final actions:

* Continue following up
* Mark as failed
* Wait and review later

## Highest Priority Explanation

For all Highest Priority creators, the system should show a short explanation below the daily task table.

The explanation should include:

* Creator username
* Sample delivery timing
* Current video progress
* Why this creator is urgent
* Suggested next action

## Output Structure

After upload, show:

1. Daily task summary
2. Daily task table sorted by priority
3. Explanation for all highest-priority creators
4. Failed candidate warnings if any
5. Prompt for the user to select one creator and generate a message

Do not generate messages for all creators automatically.
