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
    profileLink: '@fluffy_creator',
    contactMethod: 'TikTok DM',
    product: '智能宠物饮水机',
    currentStatus: 'Delivered',
    sampleShippingStatus: 'Delivered',
    sampleDeliveredDate: '2026-06-02',
    videoProgress: '0 of 2',
    firstVideoPostedDate: '',
    lastContactDate: '2026-06-01',
    lastFollowUpCount: 0,
    notes: '',
    trackingStatus: '',
    lastMessageScenario: '',
    lastMessageChannel: '',
    lastMessageSentAt: '',
    nextFollowUpDate: '',
    lastCreatorResponse: '',
    followUpHistory: [],
    ...overrides,
  };
}

function seedCreators(rows: CreatorRow[]) {
  window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows));
}

async function goTo(user: ReturnType<typeof userEvent.setup>, moduleName: RegExp) {
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  await user.click(within(nav).getByRole('button', { name: moduleName }));
}

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('operations workbench navigation and dashboard', () => {
  it('renders the fixed module navigation and opens each redesigned page', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('Creator SOP')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    await goTo(user, /Creator Database/);
    expect(screen.getByRole('heading', { name: 'Creator Database' })).toBeInTheDocument();
    expect(screen.getByText('Data Import / Export')).toBeInTheDocument();

    await goTo(user, /Outreach Templates/);
    expect(screen.getByRole('heading', { name: 'Outreach Templates' })).toBeInTheDocument();

    await goTo(user, /Sample Tracking/);
    expect(screen.getByRole('heading', { name: 'Sample Tracking' })).toBeInTheDocument();

    await goTo(user, /Follow-up Center/);
    expect(screen.getByRole('heading', { name: 'Follow-up Center' })).toBeInTheDocument();

    await goTo(user, /Content Review/);
    expect(screen.getByRole('heading', { name: 'Content Review' })).toBeInTheDocument();

    await goTo(user, /Ads Material Library/);
    expect(screen.getByRole('heading', { name: 'Ads Material Library' })).toBeInTheDocument();

    await goTo(user, /Settings/);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows the eight Dashboard metric cards and a priority todo list', () => {
    seedCreators([
      creatorRow({ id: 'invite', username: 'invite_creator', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '', videoProgress: '0 of 2' }),
      creatorRow({ id: 'follow', username: 'follow_creator', currentStatus: 'Delivered', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-05-20', videoProgress: '0 of 2' }),
      creatorRow({ id: 'request', username: 'request_creator', currentStatus: 'Sample Requested', sampleShippingStatus: 'Not Shipped', sampleDeliveredDate: '' }),
      creatorRow({ id: 'approved', username: 'approved_creator', currentStatus: 'Sample Approved', sampleShippingStatus: 'Not Shipped', sampleDeliveredDate: '' }),
      creatorRow({ id: 'shipped', username: 'shipped_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '' }),
      creatorRow({ id: 'posted', username: 'posted_creator', currentStatus: 'Posted', sampleShippingStatus: 'Delivered', videoProgress: '1 of 2', firstVideoPostedDate: '2026-06-01' }),
      creatorRow({ id: 'revision', username: 'revision_creator', currentStatus: 'Need Revision', sampleShippingStatus: 'Delivered', videoProgress: '1 of 2' }),
      creatorRow({ id: 'ads', username: 'ads_creator', currentStatus: 'Ready for Ads', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
    ]);

    render(<App />);

    [
      '今日待邀约达人数量',
      '今日待跟进达人数量',
      '待寄样达人数量',
      '已寄样待签收数量',
      '已签收待发视频数量',
      '本周已发布视频数量',
      '待验收视频数量',
      '可投流素材数量',
    ].forEach((label) => expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument());

    expect(screen.getByRole('heading', { name: '今日待办' })).toBeInTheDocument();
    expect(screen.getByText('follow_creator')).toBeInTheDocument();
    expect(screen.getAllByText(/触发原因：/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/建议动作：/).length).toBeGreaterThan(0);
  });

  it('clicks a Dashboard card to open Creator Database with the matching status filter', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'invite', username: 'invite_creator', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '' }),
      creatorRow({ id: 'delivered', username: 'delivered_creator', currentStatus: 'Delivered', sampleShippingStatus: 'Delivered' }),
    ]);

    render(<App />);
    await user.click(screen.getByRole('button', { name: /今日待邀约达人数量/ }));

    expect(screen.getByRole('heading', { name: 'Creator Database' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Status')[0]).toHaveValue('Not Contacted');
    expect(screen.getByDisplayValue('invite_creator')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('delivered_creator')).not.toBeInTheDocument();
  });

  it('shows an actionable empty state when there are no todo items', () => {
    render(<App />);

    expect(screen.getByText('今天暂无高优先级待办。')).toBeInTheDocument();
    expect(screen.getByText('下一步：导入达人表或新增达人，系统会自动生成跟进队列。')).toBeInTheDocument();
  });
});

describe('creator database redesigned table', () => {
  it('supports search, status filtering, and editable table fields', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'alpha', username: 'alpha_creator', product: 'Water Fountain', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '' }),
      creatorRow({ id: 'beta', username: 'beta_creator', product: 'Pet Comb', currentStatus: 'Ready for Ads', sampleShippingStatus: 'Delivered', videoProgress: '2 of 2' }),
    ]);

    render(<App />);
    await goTo(user, /Creator Database/);

    await user.type(screen.getByLabelText('Search'), 'alpha');
    expect(screen.getByDisplayValue('alpha_creator')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('beta_creator')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search'));
    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'Ready for Ads');
    expect(screen.getByDisplayValue('beta_creator')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('alpha_creator')).not.toBeInTheDocument();

    await user.clear(screen.getAllByLabelText('Product')[0]);
    await user.type(screen.getAllByLabelText('Product')[0], 'Updated Brush');
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? '[]') as CreatorRow[];
      expect(saved.find((row) => row.id === 'beta')?.product).toBe('Updated Brush');
    });
  });

  it('bulk-selects creators, copies outreach scripts, and bulk-updates status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    seedCreators([
      creatorRow({ id: 'alpha', username: 'alpha_creator', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '' }),
      creatorRow({ id: 'beta', username: 'beta_creator', currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '' }),
    ]);

    render(<App />);
    await goTo(user, /Creator Database/);

    await user.click(screen.getByLabelText('Select alpha_creator'));
    await user.click(screen.getByLabelText('Select beta_creator'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '批量复制邀约话术' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('@alpha_creator'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('@beta_creator'));

    await user.selectOptions(within(screen.getByText('2 selected').closest('.sticky-action-bar') as HTMLElement).getByRole('combobox'), 'Sample Approved');
    await user.click(screen.getByRole('button', { name: '批量更新状态' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? '[]') as CreatorRow[];
      expect(saved.map((row) => row.currentStatus)).toEqual(['Sample Approved', 'Sample Approved']);
    });
    expect(screen.getByRole('status')).toHaveTextContent('已更新 2 位达人状态为 Sample Approved。');
  });

  it('adds and deletes creators from the redesigned database page', async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: 'alpha', username: 'alpha_creator' })]);

    render(<App />);
    await goTo(user, /Creator Database/);
    await user.click(screen.getByRole('button', { name: 'Add Creator' }));

    expect(screen.getAllByLabelText('Creator Name')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? '[]') as CreatorRow[];
      expect(saved).toHaveLength(1);
    });
  });
});

describe('templates, follow-up, samples, review, and ads modules', () => {
  it('generates variable-based outreach templates and copies a scenario script', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<App />);
    await goTo(user, /Outreach Templates/);

    await user.type(screen.getByLabelText('creator Name'), 'Bella Pets');
    await user.clear(screen.getByLabelText('product Name'));
    await user.type(screen.getByLabelText('product Name'), 'Paw Cleaner');

    expect(screen.getByText('初次邀约')).toBeInTheDocument();
    expect(screen.getAllByText(/Bella Pets/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Bella Pets'));
  });

  it('tracks sample logistics and shows automatic next-action hints', async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({ id: 'shipped', username: 'shipped_creator', currentStatus: 'Sample Shipped', sampleShippingStatus: 'In Transit', sampleDeliveredDate: '', notes: 'carrier: UPS\ntracking: 1Z999' }),
      creatorRow({ id: 'delivered', username: 'delivered_creator', currentStatus: 'Delivered', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-05-20', videoProgress: '0 of 2' }),
    ]);

    render(<App />);
    await goTo(user, /Sample Tracking/);

    expect(screen.getByText('shipped_creator')).toBeInTheDocument();
    expect(screen.getByText('UPS')).toBeInTheDocument();
    expect(screen.getByText('1Z999')).toBeInTheDocument();
    expect(screen.getByText('已寄出但未签收：确认物流是否卡住。')).toBeInTheDocument();
    expect(screen.getByText('已签收 5 天未发布：催发视频并确认拍摄计划。')).toBeInTheDocument();
  });

  it('generates follow-up copy and marks a message as sent', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    seedCreators([creatorRow({ id: 'follow', username: 'follow_creator', sampleDeliveredDate: '2026-05-20', lastFollowUpCount: 1 })]);

    render(<App />);
    await goTo(user, /Follow-up Center/);
    await user.click(screen.getByRole('button', { name: '生成话术' }));

    expect(screen.getByText('英文话术')).toBeInTheDocument();
    expect(screen.getByText('中文解释')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '复制话术' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('follow_creator'));

    await user.click(screen.getByRole('button', { name: '标记为已发送' }));
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? '[]')[0] as CreatorRow;
      expect(saved.trackingStatus).toBe('Followed Up');
      expect(saved.lastFollowUpCount).toBe(2);
      expect(saved.followUpHistory?.[0]).toMatchObject({ action: 'Message Sent' });
    });
    expect(screen.getByText('已标记为发送，并同步更新数据表格。')).toBeInTheDocument();
  });

  it('records a creator reply from Follow-up Center', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('Creator can post Friday');
    seedCreators([creatorRow({ id: 'reply', username: 'reply_creator' })]);

    render(<App />);
    await goTo(user, /Follow-up Center/);
    await user.click(screen.getByRole('button', { name: '生成话术' }));
    await user.click(screen.getByRole('button', { name: '标记达人已回复' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? '[]')[0] as CreatorRow;
      expect(saved.currentStatus).toBe('Replied');
      expect(saved.lastCreatorResponse).toBe('Creator can post Friday');
      expect(saved.followUpHistory?.[0]).toMatchObject({ action: 'Creator Replied', note: 'Creator can post Friday' });
    });
  });

  it('renders content review checklists and ads material tags', async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: 'ads', username: 'ads_creator', currentStatus: 'Ready for Ads', videoProgress: '2 of 2', notes: 'video url: https://tiktok.com/video/1\nhook: Before After' })]);

    render(<App />);
    await goTo(user, /Content Review/);
    expect(screen.getByText('是否 40s+')).toBeInTheDocument();
    expect(screen.getByText('是否可作为投流素材')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Approved')).toBeInTheDocument();

    await goTo(user, /Ads Material Library/);
    expect(screen.getByText('Paw Cleaning')).toBeInTheDocument();
    expect(screen.getByText('High CTR Potential')).toBeInTheDocument();
    expect(screen.getByText('https://tiktok.com/video/1')).toBeInTheDocument();
    expect(screen.getAllByText('Before After').length).toBeGreaterThan(0);
  });
});

describe('settings and prompt helper', () => {
  it('saves, displays, and restores optional reference links in Settings', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await goTo(user, /Settings/);

    expect(screen.queryByText('参考视频链接')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑拍摄要求' }));
    await user.type(screen.getByLabelText('对标视频链接（可选，每行一个）'), ' https://tiktok.com/reference-one \n\nhttps://shop.tiktok.com/reference-two ');
    await user.click(screen.getByRole('button', { name: '保存拍摄要求' }));

    expect(screen.getByText('参考视频链接')).toBeInTheDocument();
    expect(screen.getByText('https://tiktok.com/reference-one')).toBeInTheDocument();
    expect(screen.getByText('https://shop.tiktok.com/reference-two')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? '{}')).toMatchObject({
      referenceLinks: ['https://tiktok.com/reference-one', 'https://shop.tiktok.com/reference-two'],
    });

    unmount();
    render(<App />);
    await goTo(user, /Settings/);
    expect(screen.getByText('https://tiktok.com/reference-one')).toBeInTheDocument();
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
    await goTo(user, /Settings/);
    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));

    expect(screen.getByLabelText('对标视频链接（可选，每行一个）')).toHaveValue('https://tiktok.com/prefill-reference');
  });

  it('generates and copies a local ChatGPT prompt without calling an API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<App />);
    await goTo(user, /Settings/);
    await user.click(screen.getByRole('button', { name: '展开辅助生成' }));
    await user.type(screen.getByLabelText('产品卖点'), '静音循环水');
    await user.click(screen.getByRole('button', { name: '生成可复制提示词' }));

    const prompt = screen.getByLabelText('ChatGPT 提示词');
    expect((prompt as HTMLTextAreaElement).value).toContain('静音循环水');
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '复制提示词' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('静音循环水'));
    expect(screen.getAllByText('已复制提示词。').length).toBeGreaterThan(0);
  });

  it('clears local creator data from Settings', async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: 'alpha', username: 'alpha_creator' })]);

    render(<App />);
    await goTo(user, /Settings/);
    await user.click(screen.getByRole('button', { name: '清空当前数据' }));

    await waitFor(() => expect(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY)).toBeNull());
    expect(screen.getByRole('status')).toHaveTextContent('已清空本地达人数据。');
  });
});
