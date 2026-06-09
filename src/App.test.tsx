import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  vi.useRealTimers();
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

  it('prefills saved reference links in the optional ChatGPT helper form', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify({
      productName: '蒸汽梳毛器',
      requirements: ['每位达人 2 条视频'],
      keyContentPoints: ['展示雾化功能'],
      referenceLinks: ['https://tiktok.com/prefill-reference'],
    }));

    render(<App />);

    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));

    expect(screen.getByLabelText('对标视频链接（可选，每行一个）')).toHaveValue('https://tiktok.com/prefill-reference');
  });
});


describe('ChatGPT prompt generator UI', () => {
  it('opens and closes the optional helper form', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('用 ChatGPT 辅助生成拍摄要求（可选）')).toBeInTheDocument();
    expect(screen.getByText('这个功能只会生成可复制的提示词，不会自动修改或保存拍摄要求。复制到 ChatGPT 生成结果后，再粘贴到上方「达人拍摄要求」里保存。')).toBeInTheDocument();
    expect(screen.queryByLabelText('产品卖点')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));

    expect(screen.getByLabelText('产品卖点')).toBeInTheDocument();
    expect(screen.getByLabelText('对标视频链接（可选，每行一个）')).toBeInTheDocument();
    expect(screen.queryByLabelText('产品名称')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收起辅助生成' }));

    expect(screen.queryByLabelText('产品卖点')).not.toBeInTheDocument();
  });

  it('generates a Chinese ChatGPT prompt locally without calling the API or auto-saving', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));
    await user.type(screen.getByLabelText('产品卖点'), '静音循环水，容易清洗，鼓励猫咪喝水');
    await user.type(screen.getByLabelText('单条视频时长要求'), '45 秒以上');
    await user.type(screen.getByLabelText('目标宠物 / 使用场景'), '美国养猫家庭厨房或客厅');
    await user.type(screen.getByLabelText('必须展示的画面'), '猫咪主动喝水\n拆洗水箱');
    await user.type(screen.getByLabelText('不希望达人这样拍'), '不要像硬广念稿');
    await user.type(screen.getByLabelText('对标视频链接（可选，每行一个）'), 'https://tiktok.com/helper-reference');
    await user.click(screen.getByRole('button', { name: '生成可复制提示词' }));

    const prompt = screen.getByLabelText('ChatGPT 提示词') as HTMLTextAreaElement;
    expect(prompt.value).toContain('蒸汽梳毛器');
    expect(prompt.value).toContain('静音循环水');
    expect(prompt.value).toContain('https://tiktok.com/helper-reference');
    expect(prompt.value).toContain('适合美国 TikTok 达人沟通');
    expect(prompt.value).toContain('不要太像合同');
    expect(prompt.value).toContain('全部使用简体中文');
    expect(prompt.value).toContain('达人拍摄要求');
    expect(prompt.value).toContain('重点拍摄内容');
    expect(screen.getByText('下一步：复制提示词到 ChatGPT，生成结果后，把适合的内容粘贴到上方「拍摄要求」和「内容重点」里，再点击保存。')).toBeInTheDocument();
    expect(screen.getByText('提示词已生成。请复制到 ChatGPT 使用。')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY)).toBeNull();
  });

  it('copies the generated prompt', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<App />);

    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));
    await user.type(screen.getByLabelText('产品卖点'), '静音循环水');
    await user.click(screen.getByRole('button', { name: '生成可复制提示词' }));
    await user.click(screen.getByRole('button', { name: '复制提示词' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('静音循环水'));
    expect(screen.getByText('已复制提示词。')).toBeInTheDocument();
  });

  it('keeps manual editing and saving as the only source of truth after generating a prompt', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));
    await user.type(screen.getByLabelText('产品卖点'), 'helper-only selling point');
    await user.click(screen.getByRole('button', { name: '生成可复制提示词' }));
    expect(screen.getByLabelText('ChatGPT 提示词')).toBeInTheDocument();
    expect(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY)).toBeNull();

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

  it('uses saved filming requirements and reference links, not unsaved helper content, in the existing message generator', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify([creatorRow({ sampleDeliveredDate: '2020-01-01', lastContactDate: '2020-01-01' })]));
    window.localStorage.setItem(FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify({
      productName: '智能宠物饮水机',
      requirements: ['每位达人 2 条视频'],
      keyContentPoints: ['saved quiet fountain shot', 'saved easy-clean tank shot'],
      referenceLinks: ['https://tiktok.com/saved-reference'],
    }));

    render(<App />);

    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));
    await user.type(screen.getByLabelText('产品卖点'), 'unsaved helper-only selling point');
    await user.type(screen.getByLabelText('对标视频链接（可选，每行一个）'), '\nhttps://tiktok.com/unsaved-helper-reference');
    await user.click(screen.getByRole('button', { name: '生成可复制提示词' }));
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    const messageOutput = screen.getByText('英文话术').closest('.message-output');
    expect(messageOutput).not.toBeNull();
    const messageArea = within(messageOutput as HTMLElement);
    expect(messageArea.getByText('英文话术')).toBeInTheDocument();
    expect(messageArea.getByText('中文解释')).toBeInTheDocument();
    expect(messageArea.getByText(/required video\(s\) are still incomplete/)).toBeInTheDocument();
    expect(messageArea.getAllByText(/https:\/\/tiktok.com\/saved-reference/).length).toBeGreaterThan(0);
    expect(messageArea.queryByText(/unsaved helper-only selling point/)).not.toBeInTheDocument();
    expect(messageArea.queryByText(/https:\/\/tiktok.com\/unsaved-helper-reference/)).not.toBeInTheDocument();
  });
});


describe('post-message tracking workflow', () => {
  function seedCreator(overrides: Partial<CreatorRow> = {}) {
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify([creatorRow(overrides)]));
  }

  async function renderAndGenerateMessage(overrides: Partial<CreatorRow> = {}) {
    seedCreator(overrides);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '生成话术' }));
    return user;
  }

  function storedCreator(): CreatorRow {
    return JSON.parse(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? '[]')[0] as CreatorRow;
  }

  it('copies only the English generated message', async () => {
    const user = await renderAndGenerateMessage();
    const englishMessage = screen.getByText('英文话术').nextElementSibling?.textContent ?? '';
    const chineseExplanation = screen.getByText('中文解释').nextElementSibling?.textContent ?? '';

    await user.click(screen.getByRole('button', { name: '复制话术' }));

    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(englishMessage));
    expect(await navigator.clipboard.readText()).not.toContain(chineseExplanation);
    expect(screen.getByText('已复制英文话术。')).toBeInTheDocument();
  });

  it('marks a generated message as sent and records follow-up tracking details', async () => {
    const user = userEvent.setup();
    seedCreator({ lastFollowUpCount: 1, lastContactDate: '2026-06-01' });
    render(<App />);
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    await user.click(screen.getByRole('button', { name: '标记为已发送' }));
    const today = new Date().toISOString().slice(0, 10);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 2);
    const expectedNextDate = nextDate.toISOString().slice(0, 10);

    await waitFor(() => {
      const saved = storedCreator();
      expect(saved.lastContactDate).toBe(today);
      expect(saved.lastFollowUpCount).toBe(2);
      expect(saved.trackingStatus).toBe('Followed Up');
      expect(saved.lastMessageScenario).toBe('样品到货后催拍');
      expect(saved.lastMessageChannel).toBe('TikTok DM');
      expect(saved.lastMessageSentAt).toBe(today);
      expect(saved.nextFollowUpDate).toBe(expectedNextDate);
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({
          date: today,
          action: 'Message Sent',
          channel: 'TikTok DM',
          scenario: '样品到货后催拍',
          message: expect.stringContaining('Hi @fluffy_creator'),
        }),
      ]));
    });
    expect(screen.getByText('已标记为发送，并同步更新数据表格。')).toBeInTheDocument();
    expect(screen.getByText('下一步跟进建议')).toBeInTheDocument();
    expect(screen.getByText(`建议下次跟进时间：${expectedNextDate}`)).toBeInTheDocument();
    expect(screen.getAllByText('Message Sent', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('样品到货后催拍', { exact: false }).length).toBeGreaterThan(0);
  });

  it('saves a creator reply note and updates the follow-up history', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('Creator will post tomorrow');
    seedCreator();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    await user.click(screen.getByRole('button', { name: '标记达人已回复' }));
    const today = new Date().toISOString().slice(0, 10);

    await waitFor(() => {
      const saved = storedCreator();
      expect(saved.lastCreatorResponse).toBe('Creator will post tomorrow');
      expect(saved.trackingStatus).toBe('Replied');
      expect(saved.lastContactDate).toBe(today);
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: today, action: 'Creator Replied', note: 'Creator will post tomorrow' }),
      ]));
    });
    expect(window.prompt).toHaveBeenCalledWith('记录达人回复内容或下一步重点：');
    expect(screen.getByText('已记录达人回复，并同步更新数据表格。')).toBeInTheDocument();
    expect(screen.getAllByText('Creator will post tomorrow').length).toBeGreaterThan(0);
  });

  it('marks cooperation completed and normalizes completion progress', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seedCreator({ videoProgress: '1 of 2', firstVideoPostedDate: '2026-06-02' });
    render(<App />);
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    await user.click(screen.getByRole('button', { name: '标记合作完成' }));
    const today = new Date().toISOString().slice(0, 10);

    await waitFor(() => {
      const saved = storedCreator();
      expect(saved.currentStatus).toBe('Completed');
      expect(saved.trackingStatus).toBe('Completed');
      expect(saved.lastContactDate).toBe(today);
      expect(saved.videoProgress).toBe('2 of 2');
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: today, action: 'Completed' }),
      ]));
    });
    expect(window.confirm).toHaveBeenCalledWith('确定要标记这个达人合作完成吗？');
    expect(screen.getByText('已标记合作完成，并同步更新数据表格。')).toBeInTheDocument();
  });

  it('marks cooperation failed while preserving priority analysis stability', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('Creator missed deadline');
    seedCreator({ sampleDeliveredDate: '2026-06-04', lastFollowUpCount: 0 });
    render(<App />);

    expect(screen.getByText('最高')).toBeInTheDocument();
    expect(screen.getAllByText(/样品已到货/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '生成话术' }));
    await user.click(screen.getByRole('button', { name: '标记合作失败' }));
    const today = new Date().toISOString().slice(0, 10);

    await waitFor(() => {
      const saved = storedCreator();
      expect(saved.currentStatus).toBe('Failed');
      expect(saved.trackingStatus).toBe('Failed');
      expect(saved.lastContactDate).toBe(today);
      expect(saved.lastCreatorResponse).toBe('Creator missed deadline');
      expect(saved.notes).toContain('Creator missed deadline');
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: today, action: 'Failed', note: 'Creator missed deadline' }),
      ]));
    });
    expect(screen.getByText('达人总数')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /今日跟进概览/ })).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith('确定要标记这个达人合作失败吗？');
    expect(window.prompt).toHaveBeenCalledWith('记录失败原因或备注（可选）：');
    expect(screen.getByText('已标记合作失败，并同步更新数据表格。')).toBeInTheDocument();
  });
});


describe('editable creator table v1.5 organization and visibility', () => {
  function seedCreators(rows: CreatorRow[]) {
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows));
  }

  it('uses Chinese headers, removes duplicate last-message-sent column, and shows no-history text', () => {
    seedCreators([creatorRow({ followUpHistory: [] })]);

    render(<App />);

    const editableTable = screen.getByRole('columnheader', { name: '跟进记录' }).closest('table');
    expect(editableTable).not.toBeNull();
    const editableTableQueries = within(editableTable as HTMLElement);

    ['达人账号', '主页链接', '联系渠道', '产品', '合作状态', '物流状态', '样品到货日期', '视频进度', '首条视频发布日期', '最近联系日期', '跟进次数', '跟进状态', '最近沟通动作', '最近沟通渠道', '下次跟进日期', '达人回复/下一步备注', '跟进记录', '备注'].forEach((header) => {
      expect(editableTableQueries.getByRole('columnheader', { name: header })).toBeInTheDocument();
    });
    expect(editableTableQueries.queryByRole('columnheader', { name: 'Last message sent at' })).not.toBeInTheDocument();
    expect(screen.getAllByText('暂无记录').length).toBeGreaterThan(0);
  });

  it('shows follow-up history counts and compact record details in the table', () => {
    seedCreators([
      creatorRow({
        followUpHistory: [
          { date: '2026-06-01', action: 'Message Sent', channel: 'TikTok DM', scenario: '样品到货后催拍', message: 'Hi @fluffy_creator, checking in.' },
          { date: '2026-06-02', action: 'Creator Replied', note: 'Will post tomorrow' },
        ],
      }),
    ]);

    render(<App />);

    expect(screen.getByText('2 条记录')).toBeInTheDocument();
    expect(screen.getByText(/已发送/)).toBeInTheDocument();
    expect(screen.getByText(/达人已回复/)).toBeInTheDocument();
    expect(screen.getByText('Will post tomorrow')).toBeInTheDocument();
  });

  it('renders urgency, cooperation status, and tracking status badges for active and archived rows', () => {
    seedCreators([
      creatorRow({ id: 'highest', username: 'highest_creator', currentStatus: 'Delivered / Waiting for Video', sampleDeliveredDate: '2026-06-07', trackingStatus: 'Followed Up' }),
      creatorRow({ id: 'completed', username: 'done_creator', currentStatus: 'Completed', trackingStatus: 'Completed', sampleDeliveredDate: '', videoProgress: '2 of 2' }),
      creatorRow({ id: 'failed', username: 'failed_creator', currentStatus: 'Failed', trackingStatus: 'Failed', sampleDeliveredDate: '' }),
      creatorRow({ id: 'replied', username: 'reply_creator', currentStatus: 'To Contact', trackingStatus: 'Replied', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    expect(screen.getAllByText(/紧急度：高|紧急度：极高/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('样品已到待拍').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待建联').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已发送待回复').length).toBeGreaterThan(0);
    expect(screen.getAllByText('达人已回复').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已失败').length).toBeGreaterThan(0);
  });
});

describe('creator follow-up queue selection', () => {
  function seedCreators(rows: CreatorRow[]) {
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows));
  }

  function optionTexts(): string[] {
    return Array.from(screen.getByRole('combobox', { name: '选择达人' }).querySelectorAll('option')).map((option) => option.textContent ?? '');
  }

  it('renames the generator section and shows only the unified urgency filters', () => {
    seedCreators([creatorRow()]);

    render(<App />);

    expect(screen.getByRole('heading', { name: '7. 达人跟进队列' })).toBeInTheDocument();
    expect(screen.getByText('按紧急程度排序达人，系统会根据当前合作阶段生成对应话术。')).toBeInTheDocument();
    const filterGroup = screen.getByLabelText('紧急程度筛选');
    expect(within(filterGroup).getAllByRole('button').map((button) => button.textContent)).toEqual(['全部', '极高', '高', '中', '低', '归档']);
    ['最高优先级', '高优先级', '待建联', '需跟进', '样品运输中', '样品已到', '部分视频', '需修改', '已完成', '失败'].forEach((label) => {
      expect(within(filterGroup).queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
  });

  it('makes all creators available and labels them with urgency plus communication action', () => {
    seedCreators([
      creatorRow({ id: 'highest', username: 'highest_creator', currentStatus: 'Delivered / Waiting for Video', sampleDeliveredDate: '2026-06-07', sampleShippingStatus: 'Delivered', videoProgress: '0 of 2', lastFollowUpCount: 0 }),
      creatorRow({ id: 'normal', username: 'normal_creator', currentStatus: 'To Contact', sampleDeliveredDate: '', sampleShippingStatus: '', videoProgress: '0 of 2', lastContactDate: '' }),
      creatorRow({ id: 'completed', username: 'done_creator', currentStatus: 'Completed', sampleDeliveredDate: '', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
      creatorRow({ id: 'failed', username: 'failed_creator', currentStatus: 'Failed', sampleDeliveredDate: '', sampleShippingStatus: '', videoProgress: '0 of 2' }),
    ]);

    render(<App />);

    const options = optionTexts();
    expect(options).toEqual(expect.arrayContaining([
      expect.stringContaining('高 · 样品到货催拍 · highest_creator'),
      expect.stringContaining('低 · 未合作邀约 · normal_creator'),
      expect.stringContaining('归档 · 合作完成维护 · done_creator'),
      expect.stringContaining('归档 · 合作失败归档 · failed_creator'),
    ]));
  });

  it('classifies To Contact with no sample shipped as 低 + 未合作邀约', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'true-to-contact', username: 'true_to_contact', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '', lastContactDate: '' }),
      creatorRow({ id: 'contacted', username: 'contacted_creator', currentStatus: 'Contacted / Waiting for Reply', sampleShippingStatus: '', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '低' }));
    expect(optionTexts()).toEqual([expect.stringContaining('低 · 未合作邀约 · true_to_contact')]);
  });

  it('classifies To Contact with In Transit as 中 or 高 + 样品运输中建联, not 未合作邀约', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'stale-to-contact', username: 'stale_in_transit', currentStatus: 'To Contact', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', lastContactDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));
    const options = optionTexts();
    expect(options).toEqual([expect.stringContaining('中 · 样品运输中建联 · stale_in_transit')]);
    expect(options.join('\n')).not.toContain('未合作邀约');
  });

  it('classifies Delivered + 0/N as 高 or 极高 + 样品到货催拍', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'delivered-status', username: 'delivered_status_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '', videoProgress: '0 of 2', lastFollowUpCount: 0 }),
      creatorRow({ id: 'not-delivered', username: 'not_delivered_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '高' }));
    const options = optionTexts().join('\n');
    expect(options).toContain('高 · 样品到货催拍 · delivered_status_creator');
    expect(options).not.toContain('not_delivered_creator');
  });

  it('classifies postedCount > 0 and postedCount < requiredVideos as 高 or 极高 + 剩余视频履约', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'partial', username: 'partial_creator', currentStatus: 'Posted Video / Waiting for Next Video', sampleShippingStatus: 'Delivered', videoProgress: '1 of 2', lastFollowUpCount: 0 }),
      creatorRow({ id: 'completed-progress', username: 'completed_progress_creator', currentStatus: 'Posted Video / Waiting for Next Video', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '高' }));
    expect(optionTexts()).toEqual([expect.stringContaining('高 · 剩余视频履约 · partial_creator')]);
  });

  it('classifies Needs Revision, Completed, and Failed with their communication actions', () => {
    seedCreators([
      creatorRow({ id: 'revision', username: 'revision_creator', currentStatus: 'Needs Revision', sampleShippingStatus: 'Delivered', videoProgress: '1 of 2' }),
      creatorRow({ id: 'completed', username: 'completed_creator', currentStatus: 'Completed', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
      creatorRow({ id: 'failed', username: 'failed_creator', currentStatus: 'Failed', sampleShippingStatus: '', videoProgress: '0 of 2' }),
    ]);

    render(<App />);

    const options = optionTexts().join('\n');
    expect(options).toContain('高 · 视频修改 · revision_creator');
    expect(options).toContain('归档 · 合作完成维护 · completed_creator');
    expect(options).toContain('归档 · 合作失败归档 · failed_creator');
  });

  it('searches creators by username, product, status, urgency, and communication action', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'username-match', username: 'alpha_creator', product: 'Water Bottle', currentStatus: 'To Contact', sampleDeliveredDate: '', sampleShippingStatus: '' }),
      creatorRow({ id: 'product-match', username: 'beta_creator', product: 'Cat Tunnel', currentStatus: 'Invited / Waiting for Sample Request', sampleDeliveredDate: '', sampleShippingStatus: '' }),
      creatorRow({ id: 'status-match', username: 'gamma_creator', product: 'Pet Comb', currentStatus: 'Needs Revision', sampleDeliveredDate: '', sampleShippingStatus: '' }),
      creatorRow({ id: 'action-match', username: 'delta_creator', product: 'Pet Brush', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    const searchInput = screen.getByLabelText('搜索达人账号 / 产品 / 状态 / 沟通动作');

    await user.type(searchInput, 'alpha');
    expect(optionTexts()).toEqual([expect.stringContaining('alpha_creator')]);

    await user.clear(searchInput);
    await user.type(searchInput, 'Cat Tunnel');
    expect(optionTexts()).toEqual([expect.stringContaining('beta_creator')]);

    await user.clear(searchInput);
    await user.type(searchInput, 'Needs Revision');
    expect(optionTexts()).toEqual([expect.stringContaining('gamma_creator')]);

    await user.clear(searchInput);
    await user.type(searchInput, '样品运输中建联');
    expect(optionTexts()).toEqual([expect.stringContaining('delta_creator')]);

    await user.clear(searchInput);
    await user.type(searchInput, '低');
    expect(optionTexts().join('\n')).toContain('alpha_creator');
  });

  it('shows urgency, communication action, and reason above English-only generated messages', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'delivered', username: 'delivered_creator', currentStatus: 'Delivered / Waiting for Video', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-06-02', videoProgress: '0 of 2', lastFollowUpCount: 0 }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '生成话术' }));
    const messageOutput = screen.getByText('英文话术').closest('.message-output');
    expect(messageOutput).not.toBeNull();
    const messageArea = within(messageOutput as HTMLElement);
    expect(messageArea.getByText(/紧急程度：极高/)).toBeInTheDocument();
    expect(messageArea.getByText(/沟通动作：样品到货催拍/)).toBeInTheDocument();
    expect(messageArea.getByText(/原因：/)).toBeInTheDocument();
    const englishMessage = screen.getByText('英文话术').nextElementSibling?.textContent ?? '';
    expect(englishMessage).not.toMatch(/[\u3400-\u9fff]/);
    expect(screen.getByRole('button', { name: '复制话术' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记为已发送' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记达人已回复' })).toBeInTheDocument();
    expect(screen.getAllByText('跟进记录').length).toBeGreaterThan(0);
  });

  it('shows a helpful generic empty state when filters or search have no matches', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'sample-shipped', username: 'sample_shipped_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '极高' }));
    expect(screen.getByText('没有匹配的达人，请调整搜索词或切换筛选。')).toBeInTheDocument();
  });
});
