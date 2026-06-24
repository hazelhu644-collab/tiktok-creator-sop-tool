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

Video progress can be entered as `0/2`, `1/2`, or `2/2`. Spreadsheet software may auto-convert values like `1/2` into a date, so users can use safer formats such as `1 of 2`, `0 of 2`, `2 of 2`, `1 video`, or `posted 1`.

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

## 如何使用这个模板

这个仓库可以作为你自己的 TikTok Creator SOP Tool 模板。请在自己的 GitHub、Vercel 和浏览器环境中使用它，不要复用仓库所有者的 SaaS、数据、API key 或 Vercel 项目。

### 1. 复制模板

* 在 GitHub 页面点击 **Use this template** 创建你自己的仓库；或
* Fork this repository 到你自己的 GitHub 账号。

### 2. 默认使用本地 / 免费模式

* 这个工具默认可以在 local/free mode 下使用，不需要配置任何付费 API。
* 上传和测试的数据会存储在你自己的浏览器 `localStorage` 中。
* `localStorage` 数据不会自动同步到 GitHub、Vercel 或其他用户账号。
* 如果你需要重置本地数据，可以清空浏览器站点数据或使用应用内的数据重置功能（如果当前版本提供）。

### 3. 部署到你自己的 Vercel

1. 登录你自己的 Vercel account。
2. 点击 **Add New Project** / **Import Project**。
3. 选择你通过模板创建或 Fork 的 repository。
4. 保持默认构建设置并点击 **Deploy**。
5. 部署完成后，打开 Vercel 提供的 deployed URL。
6. 可选：如果你需要 API 生成能力，在 Vercel Project Settings 中配置环境变量。

### 4. 可选 API 环境变量

API 是可选功能。Local/free message generation 不需要 API key，也可以正常使用基础模板能力。

如果你想启用 DeepSeek API，请在本地 `.env.local` 或 Vercel 环境变量中配置你自己的 key：

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-chat
```

说明：

* `DEEPSEEK_API_KEY`：你的 DeepSeek API key。每个用户都必须配置自己的 API key，不要使用仓库所有者或其他人的 key。
* `DEEPSEEK_MODEL`：可选模型名；如果不确定，可以先使用 `deepseek-chat`。
* 不配置 API key 时，应用仍可使用 local/free mode 进行测试和基础消息生成。

### 5. Demo Mode 测试

* 使用 **Demo Mode** 进行功能测试和演示。
* Demo Mode 使用 fake data，适合在本地、截图、演示或部署后验证流程。
* Demo Mode 不会暴露真实 creator data。
* Demo data 是假的，安全用于测试。

### 6. 隐私与安全注意事项

* 不要把真实 creator CSV 文件上传到 GitHub。
* 不要提交 `.env`、`.env.local`、`.env.production` 等环境变量文件。
* 不要提交任何 API keys、tokens 或密钥。
* 不要分享生产环境 `localStorage` 数据；其中可能包含你的真实 creator workflow 信息。
* Demo data 是 fake data，可以安全用于测试、演示和模板验证。
