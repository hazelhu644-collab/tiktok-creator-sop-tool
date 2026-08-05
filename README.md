# TikTok Creator SOP Tool

An AI-powered workflow platform for TikTok Shop creator outreach and collaboration.

This tool helps TikTok Shop sellers manage creator outreach, sample follow-up, video delivery, and collaboration status in a clear SOP-based workflow.

Built with ChatGPT + Codex for creator collaboration operations.

---

## Features

- Creator outreach workflow management
- Daily creator follow-up task list
- Sample delivery and video progress tracking
- AI-assisted creator message generation
- SOP-based collaboration status management
- Multi-stage creator pipeline
- Local creator workflow and message generation without required API keys
- Optional DeepSeek integration for creator reply translation and personalized replies
- Optional OpenAI integration for filming-requirement drafts

---

## Product Goal

After uploading a creator collaboration spreadsheet, the tool automatically analyzes each creator’s current status and generates a daily follow-up task list.

The goal is to help sellers know which creators need attention today and what action should be taken next.

---

## Target Users

- TikTok Shop small sellers
- Chinese cross-border e-commerce teams
- New sellers managing creator collaborations for the first time
- Brand-side operators who need a clearer outreach workflow

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

- 2 videos per creator
- Each video should be 60 seconds or longer
- Video 1: real review style
- Video 2: daily pet-care routine style
- Must tag the brand account
- Must add the TikTok Shop product link

Content priority:

1. Show the loose hair removed
2. Show the mist feature clearly
3. Show the pet’s real reaction during grooming
4. Show a natural daily pet-care scene
5. Show easy cleanup

---

## Creator Status Options

- Not Contacted
- Invited
- Replied
- Sample Requested
- Sample Approved
- Sample Shipped
- Delivered
- Waiting Video
- Posted
- Need Revision
- Product Tag Missing
- Ready for Ads
- Spark Ads Requested
- Completed
- Lost

---

## Spreadsheet Fields

The uploaded spreadsheet should include:

- Creator username
- Creator profile link
- Contact method
- Product
- Current status
- Sample shipping status
- Video progress
- Last contact date
- Notes

Video progress uses `X/N`, where `N` is the current Campaign's positive required-video count. `N` is not limited to a fixed list or maximum.

Spreadsheet software may auto-convert values like `1/2` into a date, so users can also use safer formats such as:

- `1 of 2`
- `0 of 2`
- `2 of 2`
- `1 video`
- `posted 1`

The system should generate:

- Suggested status
- Suggested reason
- Daily task
- Priority
- Recommended next action

---

## Daily Task Priority Rules

Priority order:

1. Highest: the creator has replied and is waiting for handling, or the product was delivered at least 2 natural days ago and video progress is still `0/N`
2. High: the creator has posted some but not all required videos, or the product is delivered but its delivery date is missing
3. Medium: creator was followed up, but has not replied after 1 day
4. Low: creator was contacted, but has not replied after 2 days

Handled-today, archived, completed, and failed work does not enter today's pending queue. A pending creator reply overrides pause notes and future follow-up dates. Without a pending reply, an explicit pause or future follow-up date suppresses the automatic delivered-age Highest rule.

---

## Failed Collaboration Candidate Rules

The system should only suggest failure. The user makes the final decision.

Suggest “Failed Candidate” when:

- Sample was delivered 7 days ago and video progress is still `0/N`; the task remains Highest and also shows the warning
- Creator was followed up twice and still has not replied
- Creator posted only 1 video and has not posted the second video after 5 days
- Creator has not replied for a long time and has no clear filming plan
- The video does not follow the brief and the creator is unwilling to correct it

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

- Native US creator communication style
- Professional but warm
- Not too humble
- Not overly excited
- Clear and direct
- Suitable for TikTok Shop creator collaboration

Channel style:

- TikTok DM: short and natural
- TikTok Shop affiliate message: medium length and clear
- Email: more complete and structured
- WhatsApp: conversational but slightly more detailed than TikTok DM

---

## Tech Stack

- TypeScript
- Vite
- ChatGPT
- Codex
- Vercel

---

## Deployment Goal

The project is designed as a lightweight web MVP that can be deployed to Vercel or Netlify.

The code should be clean and easy to extend in future versions.

---

## How to Use This Template

This repository can be used as a TikTok Creator SOP Tool template.

Please use it in your own GitHub, Vercel, and browser environment. Do not reuse the repository owner’s SaaS, data, API keys, or Vercel project.

### 1. Copy the Template

- Click **Use this template** on GitHub to create your own repository; or
- Fork this repository to your own GitHub account.

### 2. Use Local / Free Mode by Default

- API keys are optional. The app's core local features remain available without DeepSeek or OpenAI configuration.
- Local features include Excel / CSV import and export, browser-based creator data management, daily task analysis, status tracking, and local message templates.
- Uploaded data and local settings are stored in the current browser's `localStorage`.
- `localStorage` data does not automatically sync to GitHub, Vercel, or other user accounts.
- To reset local data, clear browser site data or use the available in-app reset controls.

### 3. Deploy to Your Own Vercel

1. Log in to your own Vercel account.
2. Click **Add New Project** / **Import Project**.
3. Select the repository you created from this template or fork.
4. Keep the default build settings and click **Deploy**.
5. Open the deployed URL provided by Vercel.
6. Optional: configure environment variables if you want API-based generation.

### 4. Optional API Environment Variables

Both API integrations are optional. Configure only the services you want to use in `.env.local` or your Vercel environment variables:

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

API responsibilities:

- DeepSeek translates creator replies into Chinese and generates personalized creator-facing English replies.
- OpenAI generates filming-requirement drafts through the filming-requirements API endpoint.
- Without either API key, local spreadsheet processing, creator management, task analysis, status tracking, and local message generation remain available.
- Never commit real API keys to the repository.

The Settings-page helper offers both paths. "生成可复制提示词" builds a prompt you paste into ChatGPT yourself and needs no API key. "用 AI 直接生成草稿" calls `/api/generate-filming-requirements`, which requires `OPENAI_API_KEY` in the deployment environment; the result is shown as a draft and is only written into the selected product's requirements and key content points after you confirm. `vite dev` does not serve `/api`, so the direct path only works on a deployed environment.

### 5. Public Demo Safety

Add `?demo=1` to the URL to open Safe Demo Mode, for example `https://your-deployment/?demo=1`.

In demo mode the app shows a fixed set of obviously-fake creators and one demo campaign, and a banner at the top of the workspace makes the mode visible. Nothing is read from or written to `localStorage` while it is on: `loadCreatorRows`, `loadCampaigns`, and the filming-requirements loader all short-circuit, and the storage accessors in `creatorData.ts` and `campaignData.ts` return `null`, so saves become no-ops. Real creator records are neither shown nor modified, and edits made during a demo live in React state only and disappear on reload.

Remove the parameter (or use the banner's "退出演示模式" link) to return to your own data, which is untouched.

Demo mode is the recommended way to give public demonstrations, take screenshots, or share a walkthrough link. Outside demo mode, do not import real creator data, private collaboration records, production spreadsheets, or real credentials for those purposes.

---

## Privacy and Security

- Do not upload real creator CSV files to GitHub.
- Do not commit `.env`, `.env.local`, `.env.production`, or other environment files.
- Do not commit API keys, tokens, passwords, cookies, or private credentials.
- Do not share production `localStorage` data, because it may contain real creator workflow information.
- Use Safe Demo Mode (`?demo=1`) for public or shared demonstrations; it isolates the session from your real data.
- Do not use real creator data in public or shared demonstrations.

---

## Roadmap

### Implemented

- Excel / CSV creator data import and export
- Browser-local creator and campaign data storage
- Daily task analysis and follow-up queues
- Creator database search, filtering, status management, and archiving
- Local creator message templates and follow-up message generation
- Optional DeepSeek reply translation and personalized reply generation
- OpenAI-backed filming-requirements draft API endpoint
- Content review workflow and ad-ready asset tracking
- Multi-store and multi-product campaign configuration
- Safe Demo Mode with isolated fake data (`?demo=1`)
- Direct in-app OpenAI filming-requirements draft generation

### Planned

- Browser automation support
- TikTok Shop workflow integration
- Campaign performance tracking
- Team collaboration features

---

## License

MIT License.
