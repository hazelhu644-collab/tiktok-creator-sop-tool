import { afterEach, describe, expect, it } from 'vitest';
import { buildDuplicateImportSummary, CREATOR_ROWS_STORAGE_KEY, createBlankCreatorRow, creatorRowsToCsv, deleteCreatorRow, getDuplicateCheck, loadCreatorRows, saveCreatorRows, updateCreatorField } from './creatorData';
import { normalizeRecord } from './fileParser';
import type { CreatorRow } from './types';

function row(overrides: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: 'id',
    username: 'sample_creator',
    profileLink: '',
    contactMethod: 'TikTok DM',
    product: 'Steam Grooming Brush',
    currentStatus: 'Contacted',
    sampleShippingStatus: 'Delivered',
    sampleDeliveredDate: '2026-06-01',
    videoProgress: '1 of 2',
    firstVideoPostedDate: '2026-06-03',
    lastContactDate: '2026-06-04',
    lastFollowUpCount: 1,
    notes: 'Original note',
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();

});

describe('editable creator data helpers', () => {
  it('updates edited creator fields and normalizes safe video progress text for export', () => {
    const edited = updateCreatorField(row(), 'videoProgress', '2 of 2', 2);

    expect(edited.videoProgress).toBe('2/2');
    expect(edited.videoProgressWarning).toBeUndefined();
    expect(updateCreatorField(row(), 'lastFollowUpCount', '3').lastFollowUpCount).toBe(3);
    expect(updateCreatorField(row(), 'lastFollowUpCount', '').lastFollowUpCount).toBe(0);
  });

  it('creates a valid blank creator row using the current product and required video count', () => {
    const blankRow = createBlankCreatorRow('Custom Product', 5);

    expect(blankRow).toMatchObject({
      username: '',
      profileLink: '',
      contactMethod: '',
      product: 'Custom Product',
      currentStatus: 'To Contact',
      sampleShippingStatus: 'Not Shipped',
      sampleDeliveredDate: '',
      videoProgress: '0/5',
      firstVideoPostedDate: '',
      lastContactDate: '',
      lastFollowUpCount: 0,
      notes: '',
    });
    expect(blankRow.id).toMatch(/^manual-/);
  });

  it('deletes only the selected creator row', () => {
    const rows = [row({ id: 'keep-1' }), row({ id: 'delete-me' }), row({ id: 'keep-2' })];

    expect(deleteCreatorRow(rows, 'delete-me').map((creator) => creator.id)).toEqual(['keep-1', 'keep-2']);
  });

  it('preserves blank manually created rows during localStorage save and restore', () => {
    const blankRow = createBlankCreatorRow('Saved Product', 3);

    saveCreatorRows([blankRow]);

    expect(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY)).toBeTruthy();
    expect(loadCreatorRows()).toEqual([{ ...blankRow, followUpHistory: [] }]);
  });

  it('exports the current rows with UTF-8 BOM, Chinese headers, and compact tracking counts', () => {
    const csv = creatorRowsToCsv([
      row({
        username: 'creator, one',
        notes: 'Line 1\nLine 2',
        followUpHistory: [
          { date: '2026-06-01', action: 'Message Sent' },
          { date: '2026-06-02', action: 'Creator Replied', note: 'Will post tomorrow' },
        ],
      }),
    ]);

    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv.split('\n')[0]).toBe('\ufeff达人账号,主页链接,联系渠道,店铺 / 品牌,产品,合作状态,样品到货日期,视频进度,首条视频发布日期,最近联系日期,跟进次数,跟进状态,最近沟通动作,最近沟通渠道,下次跟进日期,达人回复,达人备注,是否同达人多样品,同达人样品数量');
    expect(csv).not.toContain('样品物流状态');
    expect(csv).not.toContain('Delivered');
    expect(csv).not.toContain('预计到货日期');
    expect(csv).not.toContain('实际到货日期');
    expect(csv).not.toContain('2 条记录');
    expect(csv).not.toContain('{"date"');
    expect(csv).toContain('"creator, one"');
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it('imports older spreadsheet records without tracking columns as empty optional tracking fields', () => {
    const imported = normalizeRecord({
      'Creator username': 'legacy_creator',
      Product: 'Legacy Product',
      'Video progress': '0 of 2',
    }, 0);

    expect(imported).toMatchObject({
      username: 'legacy_creator',
      trackingStatus: '',
      lastMessageScenario: '',
      lastMessageChannel: '',
      lastMessageSentAt: '',
      nextFollowUpDate: '',
      lastCreatorResponse: '',
    });
  });

  it('imports new Chinese exported headers into the same internal fields', () => {
    const imported = normalizeRecord({
      '达人账号': 'cn_creator',
      '主页链接': 'https://example.com/cn_creator',
      '联系渠道': 'Email',
      '店铺': 'TerraPaw',
      '产品': '中文产品',
      '合作状态': '已完成',
      '样品物流状态': 'Delivered',
      '样品到货日期': '2026-06-01',
      '视频进度': '2 of 2',
      '首条视频发布日期': '2026-06-03',
      '最近联系日期': '2026-06-04',
      '跟进次数': '2',
      '跟进状态': '已完成',
      '最近沟通动作': '合作完成维护',
      '最近沟通渠道': 'TikTok DM',
      '下次跟进日期': '2026-06-06',
      '达人回复': '继续维护',
      '达人备注': 'general note',
    }, 1);

    expect(imported).toMatchObject({
      username: 'cn_creator',
      profileLink: 'https://example.com/cn_creator',
      contactMethod: 'Email',
      storeName: 'TerraPaw',
      product: '中文产品',
      currentStatus: '已完成',
      sampleShippingStatus: 'Delivered',
      sampleDeliveredDate: '2026-06-01',
      lastContactDate: '2026-06-04',
      lastFollowUpCount: 2,
      trackingStatus: '已完成',
      lastMessageScenario: '合作完成维护',
      lastMessageChannel: 'TikTok DM',
      nextFollowUpDate: '2026-06-06',
      lastCreatorResponse: '继续维护',
      notes: 'general note',
    });
  });

  it('detects same creator + same store + same product as possible duplicate without blocking row creation', () => {
    const existing = row({ id: 'a', username: '@creatorA', product: 'Pet Brush' });
    const duplicate = row({ id: 'b', username: 'creatorA', product: 'Pet Brush' });

    const result = getDuplicateCheck(duplicate, [existing]);

    expect(result.duplicateCreator).toBe(true);
    expect(result.possibleDuplicate).toBe(true);
    expect(result.multiSample).toBe(false);
  });

  it('allows same creator in the same store with a different product as valid multi-sample creator', () => {
    const existing = row({ id: 'a', username: '@creatorA', product: 'Pet Brush' });
    const secondSample = row({ id: 'b', profileLink: 'https://www.tiktok.com/@creatorA', product: 'Cat Teaser Wand' });

    const result = getDuplicateCheck(secondSample, [existing]);

    expect(result.duplicateCreator).toBe(true);
    expect(result.possibleDuplicate).toBe(false);
    expect(result.multiSample).toBe(true);
  });

  it('summarizes imported possible duplicates and valid multi-sample records without deleting rows', () => {
    const existing = [row({ id: 'existing', username: '@creatorA', product: 'Pet Brush' })];
    const incoming = [
      row({ id: 'same-product', username: 'creatorA', product: 'Pet Brush' }),
      row({ id: 'different-product', username: 'creatorA', product: 'Cat Teaser Wand' }),
    ];

    expect(buildDuplicateImportSummary(incoming, existing)).toEqual({
      possibleDuplicateCount: 1,
      multiSampleCount: 1,
      duplicateCreatorCount: 2,
    });
    expect([...incoming, ...existing]).toHaveLength(3);
  });



  it('migrates existing rows without store fields to 默认店铺', () => {
    window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify([{ ...row(), storeId: undefined, storeName: undefined }]));

    const [loaded] = loadCreatorRows();

    expect(loaded.storeName).toBe('默认店铺');
    expect(loaded.storeId).toBe('default-store');
  });

  it('allows same creator in a different store and marks cross-store creator', () => {
    const existing = row({ id: 'a', username: '@creatorA', product: 'Pet Dental Wipes', storeName: 'TerraPaw', storeId: 'terrapaw' });
    const crossStore = row({ id: 'b', username: 'creatorA', product: 'Pet Dental Wipes', storeName: 'PinePaw', storeId: 'pinepaw' });

    const result = getDuplicateCheck(crossStore, [existing]);

    expect(result.duplicateCreator).toBe(true);
    expect(result.possibleDuplicate).toBe(false);
    expect(result.multiSample).toBe(false);
    expect(result.crossStoreCreator).toBe(true);
  });

  it('imports Store and Brand headers into storeName and exports 店铺 / 品牌', () => {
    const importedStore = normalizeRecord({ Store: 'Shop A', 'Creator username': 'store_creator' }, 0);
    const importedBrand = normalizeRecord({ Brand: 'PinePaw', 'Creator username': 'brand_creator' }, 1);

    expect(importedStore.storeName).toBe('Shop A');
    expect(importedBrand.storeName).toBe('PinePaw');
    expect(creatorRowsToCsv([importedStore]).split('\\n')[0]).toContain('店铺 / 品牌');
    expect(creatorRowsToCsv([importedStore])).toContain('Shop A');
  });

  it('imports ETA and estimated arrival headers into the single sample arrival date field', () => {
    expect(normalizeRecord({ 'ETA': '2026-06-12', 'Creator username': 'eta_creator' }, 0).sampleDeliveredDate).toBe('2026-06-12');
    expect(normalizeRecord({ 'Estimated arrival date': '2026-06-13', 'Creator username': 'arrival_creator' }, 1).sampleDeliveredDate).toBe('2026-06-13');
  });

});
