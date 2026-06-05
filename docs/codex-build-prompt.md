# Codex Build Prompt

Build a lightweight deployable web MVP for the project: TikTok Creator SOP Tool.

## Main Goal

Create a web tool that helps TikTok Shop sellers upload a creator collaboration spreadsheet and generate a daily follow-up task list.

The MVP should focus on one core user question:

Who should I follow up with today, and why?

## Tech Requirement

Please build this as a lightweight web app that can be deployed later to Vercel or Netlify.

Recommended stack:

* React or Next.js
* TypeScript if possible
* Clean and simple UI
* No login required
* No database required
* No TikTok API integration required
* Data can be processed temporarily in the browser

## Input

The user should be able to upload a CSV or Excel file.

The spreadsheet columns should follow:

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

## Core Features

### 1. File Upload

Allow users to upload CSV or Excel files.

After upload, parse the creator data and show a clean table preview.

### 2. Daily Task Summary

Generate a summary showing:

* Total creators in the uploaded file
* Number of creators that need follow-up today
* Number of Highest priority tasks
* Number of High priority tasks
* Number of Medium priority tasks
* Number of Low priority tasks
* Number of Failed Candidate warnings

### 3. Daily Task Table

Generate a task table sorted by priority.

Table columns:

* Priority
* Creator username
* Product
* Current status
* Trigger reason
* Suggested action
* Contact method
* Video progress
* Failed candidate warning if applicable

### 4. Priority Logic

Use the rules from `docs/mvp-rules.md`.

Priority order:

1. Highest: sample delivered but video progress is still 0/2
2. High: creator posted 1 video but has not posted the second video
3. Medium: creator was followed up but has not replied after 1 day
4. Low: creator was contacted but has not replied after 2 days

### 5. Highest Priority Explanation

For all Highest priority creators, show a separate explanation section below the table.

Each explanation should include:

* Creator username
* Sample delivery timing
* Current video progress
* Why this creator is urgent
* Suggested next action

### 6. Failed Candidate Warning

Do not automatically mark creators as failed.

Only show a “Failed Candidate” warning if the creator matches the rules in `docs/mvp-rules.md`.

The user should still make the final decision.

### 7. Message Generator

Allow the user to select one creator from the task table and choose a channel:

* TikTok DM
* TikTok Shop Affiliate Message
* Email
* WhatsApp

Then generate:

1. English message first
2. Chinese explanation below

Use the tone rules from `docs/message-and-brief.md`.

Do not automatically generate messages for all creators.

### 8. Steam Grooming Brush Brief

Include a built-in product brief template for Steam Grooming Brush based on `docs/message-and-brief.md`.

The message generator should reference this brief when the product is Steam Grooming Brush.

## UI Requirements

Keep the interface simple.

Suggested page layout:

1. Header
2. Short product description
3. Upload area
4. Data preview
5. Daily task summary cards
6. Daily task table
7. Highest priority explanation section
8. Failed candidate warning section
9. Message generator section

The design should feel clean, practical, and suitable for a small business operations tool.

## Important Notes

Do not build:

* Login system
* Payment system
* TikTok API integration
* Database
* Complex dashboard
* Monthly report

Focus only on the first MVP.
