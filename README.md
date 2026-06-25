# TikTok Creator SOP Tool

An AI-powered workflow platform for TikTok Shop creator outreach and collaboration.

This tool helps TikTok Shop sellers manage creator outreach, sample follow-up, video delivery, and collaboration status in a clear SOP-based workflow.

Built with ChatGPT + Codex for creator collaboration operations.

---

## Features

* Creator outreach workflow management
* Daily creator follow-up task list
* Sample delivery and video progress tracking
* AI-assisted creator message generation
* SOP-based collaboration status management
* Multi-stage creator pipeline
* Demo Mode with fake data
* Local/free mode without required API keys

---

## Product Goal

After uploading a creator collaboration spreadsheet, the tool automatically analyzes each creator’s current status and generates a daily follow-up task list.

The goal is to help sellers know which creators need attention today and what action should be taken next.

---

## Target Users

* TikTok Shop small sellers
* Chinese cross-border e-commerce teams
* New sellers managing creator collaborations for the first time
* Brand-side operators who need a clearer outreach workflow

---

## Core Value

The tool helps users:

1. Know what to do next in each creator collaboration stage
2. Manage creators in a more professional brand-side workflow
3. Save time writing creator follow-up messages
4. Improve creator video delivery rate
5. Reduce wasted product samples

---

## MVP Scope

The first version is a lightweight deployable web tool.

Users can upload a spreadsheet. The tool reads the creator data, analyzes each creator’s current status, and generates a daily task list.

The MVP does not require login, database, TikTok API connection, or payment system.

All data can be processed temporarily in the browser or in the current session.

---

## First Product Template

The first product template is designed for a pet steam grooming brush.

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

---

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

---

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

Video progress can be entered as `0/2`, `1/2`, or `2/2`.

Spreadsheet software may auto-convert values like `1/2` into a date, so users can also use safer formats such as:

* `1 of 2`
* `0 of 2`
* `2 of 2`
* `1 video`
* `posted 1`

The system should generate:

* Suggested status
* Suggested reason
* Daily task
* Priority
* Recommended next action

---

## Daily Task Priority Rules

Priority order:

1. Highest: sample delivered but video progress is still 0/2
2. High: creator posted 1 video but has not posted the second video
3. Medium: creator was followed up, but has not replied after 1 day
4. Low: creator was contacted, but has not replied after 2 days

---

## Failed Collaboration Candidate Rules

The system should only suggest failure. The user makes the final decision.

Suggest “Failed Candidate” when:

* Sample was delivered 7 days ago and video progress is still 0/2
* Creator was followed up twice and still has not replied
* Creator posted only 1 video and has not posted the second video after 5 days
* Creator has not replied for a long time and has no clear filming plan
* The video does not follow the brief and the creator is unwilling to correct it

---

## Output Structure

After the user uploads a spreadsheet, the tool should show:

1. Daily task summary
2. Daily task table sorted by priority
3. Explanation for all highest-priority creators
4. Suggested next action for each creator
5. A prompt for the user to select a creator and generate a message

The tool should not automatically generate messages for all creators at once.

---

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

---

## Tech Stack

* TypeScript
* Vite
* ChatGPT
* Codex
* Vercel

---

## Deployment Goal

The project is designed as a lightweight web MVP that can be deployed to Vercel or Netlify.

The code should be clean and easy to extend in future versions.

---

## How to Use This Template

This repository can be used as a TikTok Creator SOP Tool template.

Please use it in your own GitHub, Vercel, and browser environment. Do not reuse the repository owner’s SaaS, data, API keys, or Vercel project.

### 1. Copy the Template

* Click **Use this template** on GitHub to create your own repository; or
* Fork this repository to your own GitHub account.

### 2. Use Local / Free Mode by Default

* This tool can run in local/free mode without any paid API.
* Uploaded and test data is stored in your browser `localStorage`.
* `localStorage` data does not automatically sync to GitHub, Vercel, or other user accounts.
* To reset local data, clear browser site data or use the in-app reset function if available.

### 3. Deploy to Your Own Vercel

1. Log in to your own Vercel account.
2. Click **Add New Project** / **Import Project**.
3. Select the repository you created from this template or fork.
4. Keep the default build settings and click **Deploy**.
5. Open the deployed URL provided by Vercel.
6. Optional: configure environment variables if you want API-based generation.

### 4. Optional API Environment Variables

API usage is optional. Local/free message generation works without an API key.

If you want to enable DeepSeek API, configure your own key in `.env.local` or Vercel environment variables:

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-chat
```

Notes:

* `DEEPSEEK_API_KEY`: your own DeepSeek API key.
* `DEEPSEEK_MODEL`: optional model name. If unsure, use `deepseek-chat`.
* Without an API key, the app can still use local/free mode for testing and basic message generation.

### 5. Demo Mode

* Use **Demo Mode** for testing and demos.
* Demo Mode uses fake data.
* Demo data is safe for screenshots, testing, and public walkthroughs.
* Demo Mode does not expose real creator data.

---

## Privacy and Security

* Do not upload real creator CSV files to GitHub.
* Do not commit `.env`, `.env.local`, `.env.production`, or other environment files.
* Do not commit API keys, tokens, passwords, cookies, or private credentials.
* Do not share production `localStorage` data, because it may contain real creator workflow information.
* Demo data is fake and safe for testing.

---

## Roadmap

* Browser automation support
* TikTok Shop workflow integration
* Creator CRM dashboard
* Campaign performance tracking
* Multi-product collaboration templates
* Team collaboration mode

---

## License

MIT License.
