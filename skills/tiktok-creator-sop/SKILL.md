---
name: tiktok-creator-sop
description: Build, review, or improve TikTok Shop creator collaboration SOP tools, spreadsheets, follow-up task logic, creator outreach messages, and Steam Grooming Brush product briefs. Use when Codex is asked to create a shareable workflow, productize creator operations, define daily follow-up priorities, parse creator collaboration spreadsheets, generate TikTok creator messages, or update this TikTok Creator SOP Tool codebase.
---

# TikTok Creator SOP

## Overview

Use this skill to turn TikTok Shop creator collaboration data into a practical daily follow-up workflow. Focus on the operator's core question: **Who should I follow up with today, and why?**

Keep solutions lightweight, SOP-driven, and suitable for small sellers or Chinese cross-border e-commerce teams managing US TikTok Shop creators.

## Workflow

1. Clarify the user's target output: spreadsheet rules, app implementation, daily task table, creator message, product brief, or SOP documentation.
2. If implementing or reviewing logic, read `references/creator-follow-up-rules.md`.
3. If writing outreach copy or product briefs, read `references/message-and-brief-rules.md`.
4. Preserve the MVP scope unless the user explicitly asks to expand it:
   - No login system.
   - No payment system.
   - No TikTok API integration.
   - No database requirement.
   - Temporary browser/session processing is acceptable.
5. Prefer clear operational outputs over complex dashboards.

## Spreadsheet Inputs

Expect creator collaboration CSV or Excel files to contain these fields when possible:

- Creator username
- Creator profile link
- Contact method
- Product
- Current status
- Sample shipping status
- Sample delivered date
- Video progress
- First video posted date
- Last contact date
- Last follow-up count
- Notes

Normalize imperfect inputs when reasonable. Treat `0/2`, `1/2`, and `2/2` as the primary video progress values for the MVP, but tolerate variants such as `1 of 2`, `posted 1`, and spreadsheet date-converted values when the surrounding context is clear.

## Daily Task Output

When generating or implementing task output, include:

1. Daily task summary.
2. Daily task table sorted by priority.
3. Explanation for all Highest Priority creators.
4. Failed Candidate warnings, without automatically marking anyone failed.
5. A prompt for the user to select one creator before generating a message.

Do not generate messages for every creator automatically.

## Messaging Rules

When asked to draft creator outreach:

- Output the English message first.
- Add a Chinese explanation below.
- Match the requested channel: TikTok DM, TikTok Shop Affiliate Message, Email, or WhatsApp.
- Sound like a US brand: professional, warm, direct, not overly humble, not pushy, and not translated-Chinese sounding.
- Avoid excessive praise, begging language, and repeated apologies.

For Steam Grooming Brush collaborations, emphasize loose hair removal, the mist feature, real pet reaction, natural daily care scenes, easy cleanup, tagging the brand account, and adding the TikTok Shop product link.

## Implementation Guidance

When updating a web app for this workflow:

- Keep UI copy practical and operator-friendly.
- Make status reasons visible; do not show only a score or priority label.
- Keep rule ordering deterministic: Highest, High, Medium, Low, then non-actionable/completed states.
- Preserve user choice for failed collaborations; show a warning and suggested options instead of changing status automatically.
- Use tests for priority rules, failed-candidate detection, parser normalization, and message generation behavior.
