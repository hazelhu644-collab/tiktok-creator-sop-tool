# TikTok Creator SOP Tool

A lightweight web MVP for TikTok Shop sellers to manage creator collaboration workflows.

## Product Goal

This tool helps TikTok Shop sellers manage creator outreach, sample follow-up, video delivery, and collaboration status in a clear SOP-based workflow.

The first version focuses on solving one core problem:

After uploading a creator collaboration spreadsheet, the tool should automatically generate a daily follow-up task list and tell the seller which creators need attention today.

## Target Users

* TikTok Shop small sellers
* Chinese cross-border e-commerce teams
* New sellers who do not know how to manage creator collaborations step by step

## Core Value

The tool helps users:

1. Know what to do next in each creator collaboration stage
2. Manage creators in a more professional brand-side workflow
3. Save time writing creator follow-up messages
4. Improve creator video delivery rate
5. Reduce wasted product samples

## First MVP Scope

The first version should be a deployable web tool.

Users can upload an Excel spreadsheet. The tool will read the creator data, analyze each creator’s current status, and generate a daily task list.

The MVP does not need login, database, TikTok API connection, or payment system.

All data can be processed temporarily in the browser or in the current session.

## First Product Focus

The first product template is for a pet steam grooming brush.

Video requirements:

* 2 videos per creator
* Each video should be 60 seconds or longer
* Video 1: real review style
* Video 2: daily pet-care routine style
* Must tag the brand account
* Must add the TikTok Shop product link

Content priority:

1. Show the loose hair removed
2. Show the mist feature clearly
3. Show the pet’s real reaction during grooming
4. Show a natural daily pet-care scene
5. Show easy cleanup

## Creator Status Options

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

## Spreadsheet Fields

The uploaded spreadsheet should include:

* Creator username
* Creator profile link
* Contact method
* Product
* Current status
* Sample shipping status
* Video progress
* Last contact date
* Notes

The system should generate:

* Suggested status
* Suggested reason
* Daily task
* Priority
* Recommended next action

## Daily Task Priority Rules

Priority order:

1. Highest: sample delivered but video progress is still 0/2
2. High: creator posted 1 video but has not posted the second video
3. Medium: creator was followed up, but has not replied after 1 day
4. Low: creator was contacted, but has not replied after 2 days

## Failed Collaboration Candidate Rules

The system should only suggest failure. The user makes the final decision.

Suggest “Failed Candidate” when:

* Sample was delivered 7 days ago and video progress is still 0/2
* Creator was followed up twice and still has not replied
* Creator posted only 1 video and has not posted the second video after 5 days
* Creator has not replied for a long time and has no clear filming plan
* The video does not follow the brief and the creator is unwilling to correct it

## Output Structure

After the user uploads a spreadsheet, the tool should show:

1. Daily task summary
2. Daily task table sorted by priority
3. Explanation for all highest-priority creators
4. Suggested next action for each creator
5. A prompt for the user to select a creator and generate a message

The tool should not automatically generate messages for all creators at once.

## Message Generation Logic

When the user selects a creator and contact channel, the tool should generate:

1. English message first
2. Chinese explanation below

Message style:

* Native US creator communication style
* Professional but warm
* Not too humble
* Not overly excited
* Clear and direct
* Suitable for TikTok Shop creator collaboration

Channel style:

* TikTok DM: short and natural
* TikTok Shop affiliate message: medium length and clear
* Email: more complete and structured
* WhatsApp: conversational but slightly more detailed than TikTok DM

## Deployment Goal

The project should be built as a lightweight web MVP that can be deployed later to Vercel or Netlify.

The code should be clean and easy to extend in future versions.
