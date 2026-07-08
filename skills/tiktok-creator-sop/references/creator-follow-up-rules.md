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

Conditions:

- Sample shipping status is Delivered.
- Video progress is `0/2`.
- Sample delivered date is at least 2 days ago.

Reason: The product sample has already been delivered, but the creator has not posted any video.

Suggested action: Send the first filming follow-up and remind the creator to follow the brief.

### High Priority

Conditions:

- Video progress is `1/2`.
- First video posted date is not empty.

Reason: The creator has posted only one video, but the collaboration requires two videos.

Suggested action: Ask the creator to post the second video.

### Medium Priority

Conditions:

- Current status is Followed Up.
- Last contact date is at least 1 day ago.
- Video progress is not `2/2`.

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

1. Sample shipping status is Delivered, video progress is `0/2`, and sample delivered date is at least 7 days ago.
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
