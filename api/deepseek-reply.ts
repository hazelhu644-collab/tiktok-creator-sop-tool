import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const MISSING_DEEPSEEK_API_KEY_ERROR = '未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。';

export type DeepSeekAction = 'translate_creator_reply' | 'generate_personalized_reply';

type DeepSeekReplyRequest = {
  action?: DeepSeekAction;
  creatorReply?: string;
  productName?: string;
  currentStatus?: string;
  channel?: string;
  campaignContext?: string;
  creatorUsername?: string;
  userReplyFocus?: string;
  creatorRelationshipNote?: string;
  replyTone?: string;
  replyGoal?: string;
  acceptableConcession?: string;
  productSellingPoints?: string;
  filmingRequirements?: string;
  requiredVideoCount?: string;
  requiredVideoLength?: string;
  productLinkRequirement?: string;
  referenceVideoLinks?: string;
  chineseUnderstanding?: string;
};

type TranslateCreatorReplyResponse = {
  chineseUnderstanding: string;
  detectedIntent: string;
  recommendedNextAction: string;
};

type GeneratePersonalizedReplyResponse = {
  englishMessage: string;
  chineseExplanation: string;
  detectedIntent: string;
  recommendedTrackingStatus: string;
};

type DeepSeekReplyResponse = TranslateCreatorReplyResponse | GeneratePersonalizedReplyResponse;

type ServerlessRequest = {
  method?: string;
  body?: DeepSeekReplyRequest | string;
};

type ServerlessResponse = {
  status: (statusCode: number) => ServerlessResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseRequestBody(body: ServerlessRequest['body']): DeepSeekReplyRequest {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as DeepSeekReplyRequest;
    } catch {
      return {};
    }
  }

  return body ?? {};
}

function compactJson(input: Record<string, string>): string {
  return JSON.stringify(input, null, 2);
}

function systemPrompt(): string {
  return `You are an operationally mature assistant for overseas TikTok Shop creator business development.
The human operator is Chinese and the UI is Chinese.
Creator-facing messages must be in natural English.
Chinese explanations are for the operator.
Never include Chinese characters inside englishMessage.
Keep all output as valid JSON only, with no Markdown or extra commentary.
Adapt message style by channel:
- TikTok Shop Affiliate Message: complete, professional, clear context, medium length.
- TikTok DM: shorter, natural, direct, less formal.
- Email: more formal and structured; include a subject inside englishMessage only if useful, but keep JSON fields stable.
- WhatsApp: concise, friendly but professional, short lines.
Tone options:
- 中立专业: clear, calm, professional.
- 友好一点: slightly warmer but still professional.
- 坚定推进: clearer next action and timeline.
- 最后确认: firm, administrative, not threatening.`;
}

function buildTranslateMessages(input: DeepSeekReplyRequest): ChatCompletionMessageParam[] {
  const context = compactJson({
    creatorReply: cleanText(input.creatorReply),
    productName: cleanText(input.productName),
    currentStatus: cleanText(input.currentStatus),
    channel: cleanText(input.channel),
    campaignContext: cleanText(input.campaignContext),
  });

  return [
    { role: 'system', content: systemPrompt() },
    {
      role: 'user',
      content: `Translate and summarize this creator reply for a Chinese TikTok Shop operator.
Return exactly this JSON shape: {"chineseUnderstanding":"...","detectedIntent":"...","recommendedNextAction":"..."}.
Use concise Simplified Chinese for all three fields.
Context:
${context}`,
    },
  ];
}

function buildGenerateMessages(input: DeepSeekReplyRequest): ChatCompletionMessageParam[] {
  const context = compactJson({
    creatorUsername: cleanText(input.creatorUsername),
    creatorReply: cleanText(input.creatorReply),
    userReplyFocus: cleanText(input.userReplyFocus),
    creatorRelationshipNote: cleanText(input.creatorRelationshipNote),
    replyTone: cleanText(input.replyTone) || '中立专业',
    replyGoal: cleanText(input.replyGoal),
    acceptableConcession: cleanText(input.acceptableConcession),
    channel: cleanText(input.channel),
    productName: cleanText(input.productName),
    productSellingPoints: cleanText(input.productSellingPoints),
    filmingRequirements: cleanText(input.filmingRequirements),
    requiredVideoCount: cleanText(input.requiredVideoCount),
    requiredVideoLength: cleanText(input.requiredVideoLength),
    productLinkRequirement: cleanText(input.productLinkRequirement),
    referenceVideoLinks: cleanText(input.referenceVideoLinks),
    currentStatus: cleanText(input.currentStatus),
    campaignContext: cleanText(input.campaignContext),
    chineseUnderstanding: cleanText(input.chineseUnderstanding),
  });

  return [
    { role: 'system', content: systemPrompt() },
    {
      role: 'user',
      content: `Generate a personalized creator-facing reply for overseas TikTok Shop creator BD.
Return exactly this JSON shape: {"englishMessage":"...","chineseExplanation":"...","detectedIntent":"...","recommendedTrackingStatus":"..."}.
Requirements:
- englishMessage must be English only and must not contain Chinese characters.
- Directly use the creator reply, user focus, relationship note, reply goal, acceptable concession, channel, and product campaign context.
- chineseExplanation, detectedIntent, and recommendedTrackingStatus should be Simplified Chinese for the operator.
- Do not claim an action was sent or completed.
- Do not add login, database, payment, TikTok API, auto-send, or monthly-report behavior.
Context:
${context}`,
    },
  ];
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error('DeepSeek 返回内容不是有效 JSON。');
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

function validateTranslateResponse(value: unknown): TranslateCreatorReplyResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const chineseUnderstanding = cleanText(record.chineseUnderstanding);
  const detectedIntent = cleanText(record.detectedIntent);
  const recommendedNextAction = cleanText(record.recommendedNextAction);
  if (!chineseUnderstanding || !detectedIntent || !recommendedNextAction) return null;
  return { chineseUnderstanding, detectedIntent, recommendedNextAction };
}

export function hasChineseCharacters(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function validateGenerateResponse(value: unknown): GeneratePersonalizedReplyResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const englishMessage = cleanText(record.englishMessage);
  const chineseExplanation = cleanText(record.chineseExplanation);
  const detectedIntent = cleanText(record.detectedIntent);
  const recommendedTrackingStatus = cleanText(record.recommendedTrackingStatus);
  if (!englishMessage || !chineseExplanation || !detectedIntent || !recommendedTrackingStatus) return null;
  if (hasChineseCharacters(englishMessage)) return null;
  return { englishMessage, chineseExplanation, detectedIntent, recommendedTrackingStatus };
}

function validateDeepSeekResponse(action: DeepSeekAction, content: string): DeepSeekReplyResponse {
  const parsedContent = extractJsonObject(content);
  const validated = action === 'translate_creator_reply'
    ? validateTranslateResponse(parsedContent)
    : validateGenerateResponse(parsedContent);

  if (!validated) {
    throw new Error('DeepSeek 返回 JSON 缺少必要字段或英文话术包含中文。');
  }

  return validated;
}

async function requestDeepSeek(action: DeepSeekAction, input: DeepSeekReplyRequest): Promise<DeepSeekReplyResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error(MISSING_DEEPSEEK_API_KEY_ERROR);

  const client = new OpenAI({
    baseURL: DEEPSEEK_BASE_URL,
    apiKey,
  });

  const completion = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
    temperature: action === 'translate_creator_reply' ? 0.2 : 0.4,
    response_format: { type: 'json_object' },
    messages: action === 'translate_creator_reply' ? buildTranslateMessages(input) : buildGenerateMessages(input),
    extra_body: { thinking: { type: 'disabled' } },
  } as Parameters<typeof client.chat.completions.create>[0] & { stream?: false; extra_body: { thinking: { type: string } } });

  const content = (completion as { choices?: Array<{ message?: { content?: string | null } }> }).choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 调用失败：未收到有效内容。');

  return validateDeepSeekResponse(action, content);
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: '仅支持 POST 请求。' });
  }

  try {
    const input = parseRequestBody(req.body);
    if (input.action !== 'translate_creator_reply' && input.action !== 'generate_personalized_reply') {
      return res.status(400).json({ error: 'DeepSeek action 不支持。' });
    }

    const result = await requestDeepSeek(input.action, input);
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepSeek 调用失败，请检查 API Key 或稍后重试。';
    const statusCode = message === MISSING_DEEPSEEK_API_KEY_ERROR ? 500 : 502;
    return res.status(statusCode).json({ error: message });
  }
}

export const config = {
  runtime: 'nodejs',
};
