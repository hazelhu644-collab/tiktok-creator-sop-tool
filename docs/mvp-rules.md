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

Video progress should use this format:

* 0/2
* 1/2
* 2/2

For the first MVP, assume every creator should deliver 2 videos.

## Priority Rules

The system should calculate task priority in this order:

### Highest Priority

Condition:

* Sample shipping status is Delivered
* Video progress is 0/2
* Sample delivered date is at least 2 days ago

Reason:

The product sample has already been delivered, but the creator has not posted any video.

Suggested action:

Send first filming follow-up and remind the creator to follow the brief.

### High Priority

Condition:

* Video progress is 1/2
* First video posted date is not empty

Reason:

The creator has posted only one video, but the collaboration requires two videos.

Suggested action:

Ask the creator to post the second video.

### Medium Priority

Condition:

* Current status is Followed Up
* Last contact date is at least 1 day ago
* Video progress is not 2/2

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

Sample shipping status is Delivered, video progress is 0/2, and sample delivered date is at least 7 days ago.

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
