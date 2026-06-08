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
    expect(screen.getByText('已标记为发送，并更新最后联系时间和跟进次数。')).toBeInTheDocument();
    expect(screen.getByText('下一步跟进建议')).toBeInTheDocument();
    expect(screen.getByText(`建议下次跟进时间：${expectedNextDate}`)).toBeInTheDocument();
    expect(screen.getByText('Message Sent', { exact: false })).toBeInTheDocument();
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
      expect(saved.lastContactDate).toBe(today);
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: today, action: 'Creator Replied', note: 'Creator will post tomorrow' }),
      ]));
    });
    expect(window.prompt).toHaveBeenCalledWith('记录达人回复内容或下一步重点：');
    expect(screen.getByText('Creator will post tomorrow')).toBeInTheDocument();
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
      expect(saved.videoProgress).toBe('2 of 2');
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: today, action: 'Completed' }),
      ]));
    });
    expect(window.confirm).toHaveBeenCalledWith('确定要标记这个达人合作完成吗？');
  });

  it('marks cooperation failed while preserving priority analysis stability', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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
      expect(saved.followUpHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: today, action: 'Failed' }),
      ]));
    });
    expect(screen.getByText('达人总数')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /今日跟进概览/ })).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith('确定要标记这个达人合作失败吗？');
  });
});

describe('creator communication center selection', () => {
  function seedCreators(rows: CreatorRow[]) {
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows));
  }

  it('makes all creators available in the message generator, not only Highest or High priority creators', () => {
    seedCreators([
      creatorRow({ id: 'highest', username: 'highest_creator', currentStatus: 'Delivered / Waiting for Video', sampleDeliveredDate: '2020-01-01', sampleShippingStatus: 'Delivered', videoProgress: '0 of 2' }),
      creatorRow({ id: 'medium', username: 'medium_creator', currentStatus: 'Followed Up', sampleDeliveredDate: '', sampleShippingStatus: 'Pending', videoProgress: '0 of 2', lastContactDate: '2020-01-01' }),
      creatorRow({ id: 'normal', username: 'normal_creator', currentStatus: 'To Contact', sampleDeliveredDate: '', sampleShippingStatus: '', videoProgress: '0 of 2', lastContactDate: '' }),
      creatorRow({ id: 'completed', username: 'done_creator', currentStatus: 'Completed', sampleDeliveredDate: '', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
      creatorRow({ id: 'failed', username: 'failed_creator', currentStatus: 'Failed', sampleDeliveredDate: '', sampleShippingStatus: '', videoProgress: '0 of 2' }),
    ]);

    render(<App />);

    const creatorSelect = screen.getByRole('combobox', { name: '选择达人' });
    const optionText = Array.from(creatorSelect.querySelectorAll('option')).map((option) => option.textContent ?? '');

    expect(optionText).toEqual(expect.arrayContaining([
      expect.stringContaining('highest_creator'),
      expect.stringContaining('medium_creator'),
      expect.stringContaining('normal_creator'),
      expect.stringContaining('done_creator'),
      expect.stringContaining('failed_creator'),
    ]));
    expect(optionText.find((text) => text.includes('normal_creator'))).toContain('普通');
    expect(optionText.find((text) => text.includes('done_creator'))).toContain('已完成');
    expect(optionText.find((text) => text.includes('failed_creator'))).toContain('失败');
  });


  it('filters 待建联 to true first-outreach creators without shipped or delivered samples', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'true-to-contact', username: 'true_to_contact', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '', lastContactDate: '' }),
      creatorRow({ id: 'in-transit-to-contact', username: 'stale_to_contact', currentStatus: 'To Contact', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', lastContactDate: '' }),
      creatorRow({ id: 'contacted', username: 'contacted_creator', currentStatus: 'Contacted / Waiting for Reply', sampleShippingStatus: '', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    expect(screen.getByRole('button', { name: '待建联' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '待联系' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '待建联' }));
    const creatorSelect = screen.getByRole('combobox', { name: '选择达人' });
    const optionText = Array.from(creatorSelect.querySelectorAll('option')).map((option) => option.textContent ?? '');

    expect(optionText).toEqual([expect.stringContaining('true_to_contact')]);
    expect(optionText.join('\n')).not.toContain('stale_to_contact');
    expect(optionText.join('\n')).not.toContain('contacted_creator');
  });

  it('routes To Contact creators with in-transit samples to 样品运输中 instead of 待建联', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'stale-to-contact', username: 'stale_in_transit', currentStatus: 'To Contact', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', lastContactDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '待建联' }));
    expect(screen.getByText('当前没有纯待建联达人。样品已发出或已到货的达人，请查看「样品运输中」「样品已到」或「需跟进」。')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '选择达人' }).querySelectorAll('option')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '样品运输中' }));
    const optionText = Array.from(screen.getByRole('combobox', { name: '选择达人' }).querySelectorAll('option')).map((option) => option.textContent ?? '');
    expect(optionText).toEqual([expect.stringContaining('stale_in_transit')]);
  });

  it('includes shipped or in-transit creators in 需跟进 while excluding terminal statuses', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'sample-shipped', username: 'sample_shipped_in_transit', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', videoProgress: '0 of 2' }),
      creatorRow({ id: 'completed', username: 'completed_creator', currentStatus: 'Completed', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', videoProgress: '2 of 2' }),
      creatorRow({ id: 'failed', username: 'failed_creator', currentStatus: 'Failed', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', videoProgress: '0 of 2' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '需跟进' }));
    const optionText = Array.from(screen.getByRole('combobox', { name: '选择达人' }).querySelectorAll('option')).map((option) => option.textContent ?? '');

    expect(optionText).toEqual([expect.stringContaining('sample_shipped_in_transit')]);
    expect(optionText.join('\n')).not.toContain('completed_creator');
    expect(optionText.join('\n')).not.toContain('failed_creator');
  });

  it('finds delivered creators by delivered shipping status or delivered date', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'delivered-status', username: 'delivered_status_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '' }),
      creatorRow({ id: 'delivered-date', username: 'delivered_date_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'Pending', sampleDeliveredDate: '2026-06-01' }),
      creatorRow({ id: 'not-delivered', username: 'not_delivered_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '样品已到' }));
    const optionText = Array.from(screen.getByRole('combobox', { name: '选择达人' }).querySelectorAll('option')).map((option) => option.textContent ?? '').join('\n');

    expect(optionText).toContain('delivered_status_creator');
    expect(optionText).toContain('delivered_date_creator');
    expect(optionText).not.toContain('not_delivered_creator');
  });

  it('keeps 部分视频 focused on incomplete partial video progress', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'partial', username: 'partial_creator', currentStatus: 'Posted Video / Waiting for Next Video', sampleShippingStatus: 'Delivered', videoProgress: '1 of 2' }),
      creatorRow({ id: 'none-posted', username: 'none_posted_creator', currentStatus: 'Delivered / Waiting for Video', sampleShippingStatus: 'Delivered', videoProgress: '0 of 2' }),
      creatorRow({ id: 'completed-progress', username: 'completed_progress_creator', currentStatus: 'Posted Video / Waiting for Next Video', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '部分视频' }));
    const optionText = Array.from(screen.getByRole('combobox', { name: '选择达人' }).querySelectorAll('option')).map((option) => option.textContent ?? '');

    expect(optionText).toEqual([expect.stringContaining('partial_creator')]);
  });

  it('shows a helpful generic empty state when filters or search have no matches', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'sample-shipped', username: 'sample_shipped_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '' }),
    ]);

    render(<App />);

    await user.click(screen.getByRole('button', { name: '样品已到' }));
    expect(screen.getByText('没有匹配的达人，请调整搜索词或切换筛选。')).toBeInTheDocument();
  });

  it('searches creators by username, product, and current status', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'username-match', username: 'alpha_creator', product: 'Water Bottle', currentStatus: 'To Contact', sampleDeliveredDate: '', sampleShippingStatus: '' }),
      creatorRow({ id: 'product-match', username: 'beta_creator', product: 'Cat Tunnel', currentStatus: 'Invited / Waiting for Sample Request', sampleDeliveredDate: '', sampleShippingStatus: '' }),
      creatorRow({ id: 'status-match', username: 'gamma_creator', product: 'Pet Comb', currentStatus: 'Needs Revision', sampleDeliveredDate: '', sampleShippingStatus: '' }),
    ]);

    render(<App />);

    const searchInput = screen.getByLabelText('搜索达人账号 / 产品 / 状态');
    const creatorSelect = screen.getByRole('combobox', { name: '选择达人' });

    await user.type(searchInput, 'alpha');
    expect(Array.from(creatorSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      expect.stringContaining('alpha_creator'),
    ]);

    await user.clear(searchInput);
    await user.type(searchInput, 'Cat Tunnel');
    expect(Array.from(creatorSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      expect.stringContaining('beta_creator'),
    ]);

    await user.clear(searchInput);
    await user.type(searchInput, 'Needs Revision');
    expect(Array.from(creatorSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      expect.stringContaining('gamma_creator'),
    ]);
  });
});
