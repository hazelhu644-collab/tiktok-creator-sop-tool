type GenerateFilmingRequirementsRequest = {
  productName?: string;
  sellingPoints?: string;
  videoCount?: string;
  durationRequirement?: string;
  targetPetOrScene?: string;
  mustShowShots?: string;
  avoidShots?: string;
  referenceLinks?: string;
};

type GenerateFilmingRequirementsResponse = {
  productName: string;
  requirements: string[];
  priorities: string[];
};

type ServerlessRequest = {
  method?: string;
  body?: GenerateFilmingRequirementsRequest | string;
};

type ServerlessResponse = {
  status: (statusCode: number) => ServerlessResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MISSING_API_KEY_ERROR = 'AI 生成失败：未配置 OPENAI_API_KEY。';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseRequestBody(body: ServerlessRequest['body']): GenerateFilmingRequirementsRequest {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as GenerateFilmingRequirementsRequest;
    } catch {
      return {};
    }
  }

  return body ?? {};
}

function fallbackProductName(productName: string): string {
  return productName || '未命名产品';
}

function buildPrompt(input: Required<GenerateFilmingRequirementsRequest>): string {
  return `请基于以下产品信息，为美国 TikTok Shop 达人生成一版「达人拍摄要求」草稿。\n\n产品名称：${input.productName}\n产品卖点：${input.sellingPoints}\n目标视频数量：${input.videoCount}\n单条视频时长要求：${input.durationRequirement}\n目标宠物 / 使用场景：${input.targetPetOrScene}\n必须展示的画面：${input.mustShowShots}\n不希望达人这样拍：${input.avoidShots}\n参考视频链接（可选）：${input.referenceLinks}\n\n输出要求：\n- 只输出 JSON，不要 Markdown，不要解释。\n- JSON 结构必须是 {"productName":"string","requirements":["string"],"priorities":["string"]}。\n- productName 使用表单里的产品名称。\n- requirements 必须包含：每位达人 X 条视频、每条视频 XX 秒以上、必须 tag 品牌账号、必须挂 TikTok Shop 产品链接。\n- requirements 可加入其它必要要求，但总数控制在 5 到 8 条。\n- priorities 生成 5 到 8 条简洁内容重点，基于卖点、场景、必须展示画面和避免事项。\n- 全部使用简体中文。\n- 风格清晰、实用、适合 TikTok Shop 达人沟通，不要像正式合同。`;
}

function buildRequiredInput(body: GenerateFilmingRequirementsRequest): Required<GenerateFilmingRequirementsRequest> {
  return {
    productName: fallbackProductName(cleanText(body.productName)),
    sellingPoints: cleanText(body.sellingPoints) || '未提供',
    videoCount: cleanText(body.videoCount) || '2',
    durationRequirement: cleanText(body.durationRequirement) || '60 秒以上',
    targetPetOrScene: cleanText(body.targetPetOrScene) || '日常真实使用场景',
    mustShowShots: cleanText(body.mustShowShots) || '产品使用过程和效果',
    avoidShots: cleanText(body.avoidShots) || '避免夸大效果或过度硬广',
    referenceLinks: cleanText(body.referenceLinks) || '未提供',
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
}

function ensureCoreRequirements(requirements: string[], input: Required<GenerateFilmingRequirementsRequest>): string[] {
  const coreRequirements = [
    `每位达人 ${input.videoCount} 条视频`,
    `每条视频 ${input.durationRequirement}`,
    '必须 tag 品牌账号',
    '必须挂 TikTok Shop 产品链接',
  ];

  const combinedRequirements = [...coreRequirements];
  for (const requirement of requirements) {
    if (!combinedRequirements.some((item) => item === requirement)) {
      combinedRequirements.push(requirement);
    }
  }

  return combinedRequirements.slice(0, 8);
}

function validateGeneratedJson(value: unknown, input: Required<GenerateFilmingRequirementsRequest>): GenerateFilmingRequirementsResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const requirements = ensureCoreRequirements(normalizeStringList(record.requirements), input);
  const priorities = normalizeStringList(record.priorities);

  if (requirements.length === 0 || priorities.length === 0) return null;

  return {
    productName: cleanText(record.productName) || input.productName,
    requirements,
    priorities,
  };
}

async function requestOpenAiDraft(input: Required<GenerateFilmingRequirementsRequest>): Promise<GenerateFilmingRequirementsResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(MISSING_API_KEY_ERROR);
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是熟悉美国 TikTok Shop 达人合作的中文运营助手。你只输出可解析 JSON。',
        },
        {
          role: 'user',
          content: buildPrompt(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('AI 生成失败：OpenAI 请求失败，请稍后重试。');
  }

  const completion = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 生成失败：未收到有效内容。');
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new Error('AI 生成失败：返回内容不是有效 JSON。');
  }

  const generatedDraft = validateGeneratedJson(parsedContent, input);
  if (!generatedDraft) {
    throw new Error('AI 生成失败：返回 JSON 缺少必要字段。');
  }

  return generatedDraft;
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: '仅支持 POST 请求。' });
  }

  try {
    const input = buildRequiredInput(parseRequestBody(req.body));
    const draft = await requestOpenAiDraft(input);
    return res.status(200).json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 生成失败：请稍后重试。';
    const statusCode = message === MISSING_API_KEY_ERROR ? 500 : 502;
    return res.status(statusCode).json({ error: message });
  }
}

export const config = {
  runtime: 'nodejs',
};
