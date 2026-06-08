import { afterEach, describe, expect, it } from 'vitest';
import { CREATOR_ROWS_STORAGE_KEY, createBlankCreatorRow, creatorRowsToCsv, deleteCreatorRow, loadCreatorRows, saveCreatorRows, updateCreatorField } from './creatorData';
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
    const edited = updateCreatorField(row(), 'videoProgress', '2 of 2');

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
      videoProgress: '0 of 5',
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

  it('exports the current rows with the template columns plus optional tracking fields', () => {
    const csv = creatorRowsToCsv([
      row({ username: 'creator, one', notes: 'Line 1\nLine 2' }),
    ]);

    expect(csv.split('\n')[0]).toBe('Creator username,Creator profile link,Contact method,Product,Current status,Sample shipping status,Sample delivered date,Video progress,First video posted date,Last contact date,Last follow-up count,Notes,Tracking status,Last message scenario,Last message channel,Last message sent at,Next follow-up date,Last creator response');
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
});
