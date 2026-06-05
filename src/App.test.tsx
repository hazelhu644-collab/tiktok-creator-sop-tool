import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CREATOR_ROWS_STORAGE_KEY } from './creatorData';
import type { CreatorRow } from './types';

const FILMING_REQUIREMENTS_STORAGE_KEY = 'tiktokCreatorSop.filmingRequirements';

function creatorRow(overrides: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: 'creator-1',
    username: 'fluffy_creator',
    profileLink: '',
    contactMethod: 'TikTok DM',
    product: '智能宠物饮水机',
    currentStatus: 'Sample Delivered',
    sampleShippingStatus: 'Delivered',
    sampleDeliveredDate: '2026-06-02',
    videoProgress: '0 of 3',
    firstVideoPostedDate: '',
    lastContactDate: '2026-06-01',
    lastFollowUpCount: 0,
    notes: '',
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('AI filming requirements generator UI', () => {
  it('opens and closes the AI generation form', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'AI 生成拍摄要求' }));

    expect(screen.getByText('AI 拍摄要求草稿生成')).toBeInTheDocument();
    expect(screen.getByLabelText('产品卖点')).toBeInTheDocument();
    expect(screen.getByLabelText('参考视频链接（可选）')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByText('AI 拍摄要求草稿生成')).not.toBeInTheDocument();
  });

  it('fills draft filming requirements from a successful API response without auto-saving', async () => {
    const user = userEvent.setup();
    let resolveDraft: (response: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveDraft = resolve;
    })));

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'AI 生成拍摄要求' }));
    await user.clear(screen.getByLabelText('产品名称'));
    await user.type(screen.getByLabelText('产品名称'), '智能宠物饮水机');
    await user.type(screen.getByLabelText('产品卖点'), '静音循环水，容易清洗，鼓励猫咪喝水');
    await user.type(screen.getByLabelText('单条视频时长要求'), '45 秒以上');
    await user.click(screen.getByRole('button', { name: '生成草稿' }));

    expect(screen.getByText('AI 正在生成拍摄要求...')).toBeInTheDocument();

    resolveDraft(new Response(JSON.stringify({
      productName: '智能宠物饮水机',
      requirements: [
        '每位达人 3 条视频',
        '每条视频 45 秒以上',
        '必须 tag 品牌账号',
        '必须挂 TikTok Shop 产品链接',
      ],
      priorities: ['展示猫咪主动喝水', '展示静音运行', '展示可拆洗水箱', '展示真实家居场景', '避免像硬广念稿'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await waitFor(() => expect(screen.getByText('已生成拍摄要求草稿，你可以手动修改后保存。')).toBeInTheDocument());

    expect(screen.getByDisplayValue('智能宠物饮水机')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/每位达人 3 条视频/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/展示猫咪主动喝水/)).toBeInTheDocument();
    expect(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY)).toBeNull();
  });

  it('keeps manual editing available after AI fills the draft', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      productName: '智能宠物饮水机',
      requirements: ['每位达人 3 条视频', '每条视频 45 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
      priorities: ['展示猫咪主动喝水', '展示静音运行', '展示可拆洗水箱', '展示真实家居场景', '避免像硬广念稿'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'AI 生成拍摄要求' }));
    await user.click(screen.getByRole('button', { name: '生成草稿' }));
    await screen.findByText('已生成拍摄要求草稿，你可以手动修改后保存。');

    const requirementsDraft = screen.getByDisplayValue(/每位达人 3 条视频/);
    await user.clear(requirementsDraft);
    await user.type(requirementsDraft, '每位达人 4 条视频\n必须 tag 品牌账号\n必须挂 TikTok Shop 产品链接');
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));

    expect(screen.getByText('每位达人 4 条视频')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? '{}')).toMatchObject({
      requirements: ['每位达人 4 条视频', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
    });
  });

  it('uses saved AI-generated requirements in the existing message generator', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify([creatorRow()]));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      productName: '智能宠物饮水机',
      requirements: ['每位达人 3 条视频', '每条视频 45 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
      priorities: ['quiet fountain shot', 'easy-clean tank shot', 'cat drinking naturally', 'home kitchen setup', 'show product link reminder'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'AI 生成拍摄要求' }));
    await user.click(screen.getByRole('button', { name: '生成草稿' }));
    await screen.findByText('已生成拍摄要求草稿，你可以手动修改后保存。');
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    expect(screen.getByText('英文话术')).toBeInTheDocument();
    expect(screen.getByText('中文解释')).toBeInTheDocument();
    expect(screen.getAllByText(/quiet fountain shot/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/每位达人 3 条视频/).length).toBeGreaterThan(0);
  });
});
