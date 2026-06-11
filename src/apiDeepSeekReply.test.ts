import { afterEach, describe, expect, it, vi } from 'vitest';

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAIMock {
    chat = {
      completions: {
        create: createMock,
      },
    };
  },
}));

import handler, { hasChineseCharacters } from '../api/deepseek-reply';

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
  vi.clearAllMocks();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
});

describe('DeepSeek reply API route', () => {
  it('missing DEEPSEEK_API_KEY returns a clear error without exposing a key', async () => {
    const res = createResponse();

    await handler({ method: 'POST', body: { action: 'translate_creator_reply', creatorReply: 'Yes' } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: '未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。' });
    expect(JSON.stringify(res.body)).not.toContain('test-secret-key');
    expect(JSON.stringify(res.body)).not.toContain('建议');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('translate_creator_reply returns direct Chinese translation only', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret-key';
    createMock.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            chineseTranslation: '我可以周五发布。',
          }),
        },
      }],
    });
    const res = createResponse();

    await handler({ method: 'POST', body: { action: 'translate_creator_reply', creatorReply: 'I can post Friday.', productName: 'Pet Fountain', currentStatus: 'Replied', channel: 'TikTok DM' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      chineseTranslation: '我可以周五发布。',
    });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek-v4-pro',
      response_format: { type: 'json_object' },
      extra_body: { thinking: { type: 'disabled' } },
    }));
    expect(JSON.stringify(res.body)).not.toContain('test-secret-key');
  });

  it('generate_personalized_reply returns structured JSON and English-only creator message', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    createMock.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            englishMessage: 'Hi @creator, thank you for letting us know. Could you confirm the expected posting date so our team can plan the ad testing schedule?',
            chineseExplanation: '先表达理解，再确认发布时间，方便安排投流。',
            detectedIntent: '延迟但继续合作',
            recommendedTrackingStatus: '达人已回复，等待发布时间确认',
          }),
        },
      }],
    });
    const res = createResponse();

    await handler({ method: 'POST', body: { action: 'generate_personalized_reply', creatorUsername: 'creator', creatorReply: 'I sprained my ankle.', channel: 'TikTok Shop Affiliate Message', productName: 'Pet Fountain', campaignContext: '2 videos, product link required' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      englishMessage: 'Hi @creator, thank you for letting us know. Could you confirm the expected posting date so our team can plan the ad testing schedule?',
      chineseExplanation: '先表达理解，再确认发布时间，方便安排投流。',
      detectedIntent: '延迟但继续合作',
      recommendedTrackingStatus: '达人已回复，等待发布时间确认',
    });
    expect(hasChineseCharacters((res.body as { englishMessage: string }).englishMessage)).toBe(false);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'deepseek-v4-flash' }));
    expect(JSON.stringify(res.body)).not.toContain('test-secret-key');
  });

  it('does not expose the API key when DeepSeek returns an upstream error', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret-key';
    createMock.mockRejectedValueOnce(new Error('upstream unavailable'));
    const res = createResponse();

    await handler({ method: 'POST', body: { action: 'translate_creator_reply', creatorReply: 'Yes' } }, res);

    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('test-secret-key');
  });
});
