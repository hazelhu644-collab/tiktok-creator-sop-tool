import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/generate-filming-requirements';

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };

  return response;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

describe('generate filming requirements API route', () => {
  it('returns a safe Chinese error when OPENAI_API_KEY is missing', async () => {
    const res = createResponse();

    await handler({ method: 'POST', body: { productName: '智能宠物饮水机' } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'AI 生成失败：未配置 OPENAI_API_KEY。' });
  });

  it('returns structured JSON from a successful OpenAI response', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: '智能宠物饮水机',
            requirements: ['每位达人 3 条视频', '每条视频 45 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
            priorities: ['展示猫咪喝水', '展示静音运行', '展示清洗过程', '展示家居场景', '不要夸大效果'],
          }),
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const res = createResponse();

    await handler({ method: 'POST', body: { productName: '智能宠物饮水机', videoCount: '3', durationRequirement: '45 秒以上' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      productName: '智能宠物饮水机',
      requirements: ['每位达人 3 条视频', '每条视频 45 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
      priorities: ['展示猫咪喝水', '展示静音运行', '展示清洗过程', '展示家居场景', '不要夸大效果'],
    });
  });
});
