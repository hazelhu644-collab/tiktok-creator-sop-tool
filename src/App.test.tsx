import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    videoProgress: '0 of 2',
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



describe('filming requirements reference links UI', () => {
  it('saves, displays, and restores optional reference links with filming requirements', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    expect(screen.queryByText('参考视频链接')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑拍摄要求' }));
    await user.type(
      screen.getByLabelText('对标视频链接（可选，每行一个）'),
      ' https://tiktok.com/reference-one \n\nhttps://shop.tiktok.com/reference-two ',
    );
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));

    expect(screen.getByText('参考视频链接')).toBeInTheDocument();
    expect(screen.getByText('https://tiktok.com/reference-one')).toBeInTheDocument();
    expect(screen.getByText('https://shop.tiktok.com/reference-two')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? '{}')).toMatchObject({
      referenceLinks: ['https://tiktok.com/reference-one', 'https://shop.tiktok.com/reference-two'],
    });

    unmount();
    render(<App />);

    expect(screen.getByText('参考视频链接')).toBeInTheDocument();
    expect(screen.getByText('https://tiktok.com/reference-one')).toBeInTheDocument();
    expect(screen.getByText('https://shop.tiktok.com/reference-two')).toBeInTheDocument();
  });

  it('allows empty reference links and restores default by clearing them', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '编辑拍摄要求' }));
    await user.type(screen.getByLabelText('对标视频链接（可选，每行一个）'), '   \n  ');
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));

    expect(screen.queryByText('参考视频链接')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? '{}')).toMatchObject({
      referenceLinks: [],
    });

    await user.click(screen.getByRole('button', { name: '编辑拍摄要求' }));
    await user.type(screen.getByLabelText('对标视频链接（可选，每行一个）'), 'https://tiktok.com/reference-one');
    await user.click(screen.getByRole('button', { name: '恢复默认拍摄要求' }));

    expect(screen.queryByText('参考视频链接')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? '{}')).toMatchObject({
      referenceLinks: [],
    });
  });

  it('prefills saved reference links in the ChatGPT prompt form', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify({
      productName: '蒸汽梳毛器',
      requirements: ['每位达人 2 条视频'],
      keyContentPoints: ['展示雾化功能'],
      referenceLinks: ['https://tiktok.com/prefill-reference'],
    }));

    render(<App />);

    await user.click(screen.getByRole('button', { name: '生成 ChatGPT 提示词' }));

    expect(screen.getByLabelText('参考视频链接（可选）')).toHaveValue('https://tiktok.com/prefill-reference');
  });
});


describe('ChatGPT prompt generator UI', () => {
  it('opens and closes the local ChatGPT prompt form', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '生成 ChatGPT 提示词' }));

    expect(screen.getByText('ChatGPT 提示词生成')).toBeInTheDocument();
    expect(screen.getByText('当前版本不调用 API，不产生额外费用。你可以复制提示词到 ChatGPT 生成拍摄要求，再手动粘贴回来保存。')).toBeInTheDocument();
    expect(screen.getByLabelText('产品卖点')).toBeInTheDocument();
    expect(screen.getByLabelText('参考视频链接（可选）')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByText('ChatGPT 提示词生成')).not.toBeInTheDocument();
  });

  it('generates a Chinese ChatGPT prompt locally without calling the API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '生成 ChatGPT 提示词' }));
    await user.clear(screen.getByLabelText('产品名称'));
    await user.type(screen.getByLabelText('产品名称'), '智能宠物饮水机');
    await user.type(screen.getByLabelText('产品卖点'), '静音循环水，容易清洗，鼓励猫咪喝水');
    await user.type(screen.getByLabelText('单条视频时长要求'), '45 秒以上');
    await user.type(screen.getByLabelText('目标宠物 / 使用场景'), '美国养猫家庭厨房或客厅');
    await user.type(screen.getByLabelText('必须展示的画面'), '猫咪主动喝水\n拆洗水箱');
    await user.type(screen.getByLabelText('不希望达人这样拍'), '不要像硬广念稿');
    await user.click(screen.getAllByRole('button', { name: '生成 ChatGPT 提示词' })[1]);

    const prompt = screen.getByLabelText('ChatGPT 提示词') as HTMLTextAreaElement;
    expect(prompt.value).toContain('智能宠物饮水机');
    expect(prompt.value).toContain('适合美国 TikTok 达人沟通');
    expect(prompt.value).toContain('不要太像合同');
    expect(prompt.value).toContain('全部使用简体中文');
    expect(prompt.value).toContain('达人拍摄要求');
    expect(prompt.value).toContain('重点拍摄内容');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY)).toBeNull();
  });

  it('copies the generated prompt', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<App />);

    await user.click(screen.getByRole('button', { name: '生成 ChatGPT 提示词' }));
    await user.type(screen.getByLabelText('产品卖点'), '静音循环水');
    await user.click(screen.getAllByRole('button', { name: '生成 ChatGPT 提示词' })[1]);
    await user.click(screen.getByRole('button', { name: '复制提示词' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('静音循环水'));
    expect(screen.getByText('已复制提示词。')).toBeInTheDocument();
  });

  it('keeps manual editing and saving available after generating a prompt', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '生成 ChatGPT 提示词' }));
    await user.click(screen.getAllByRole('button', { name: '生成 ChatGPT 提示词' })[1]);
    expect(screen.getByLabelText('ChatGPT 提示词')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑拍摄要求' }));
    const requirementsDraft = screen.getByLabelText('拍摄要求（每行一条）');
    await user.clear(requirementsDraft);
    await user.type(requirementsDraft, '每位达人 4 条视频\n必须 tag 品牌账号\n必须挂 TikTok Shop 产品链接');
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));

    expect(screen.getByText('每位达人 4 条视频')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? '{}')).toMatchObject({
      requirements: ['每位达人 4 条视频', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
    });
  });

  it('uses manually saved requirements in the existing message generator', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify([creatorRow({ sampleDeliveredDate: '2020-01-01', lastContactDate: '2020-01-01' })]));

    render(<App />);

    await user.click(screen.getByRole('button', { name: '编辑拍摄要求' }));
    await user.clear(screen.getByLabelText('内容重点（每行一条）'));
    await user.type(screen.getByLabelText('内容重点（每行一条）'), 'quiet fountain shot\neasy-clean tank shot\ncat drinking naturally');
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    expect(screen.getByText('英文话术')).toBeInTheDocument();
    expect(screen.getByText('中文解释')).toBeInTheDocument();
    expect(screen.getAllByText(/quiet fountain shot/).length).toBeGreaterThan(0);
  });
});
