import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREATOR_FILMING_REQUIREMENTS,
  createBlankCreatorRow,
  creatorRowsToCsv,
  saveFilmingRequirements,
  updateCreatorField,
} from './creatorData';
import type { CreatorFilmingRequirements, CreatorRow } from './types';

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

describe('editable creator data helpers', () => {
  it('creates a blank row with current filming requirement product defaults', () => {
    const customRequirements: CreatorFilmingRequirements = {
      ...DEFAULT_CREATOR_FILMING_REQUIREMENTS,
      productName: 'Pet Water Fountain',
    };

    expect(createBlankCreatorRow(customRequirements, 123)).toMatchObject({
      id: 'manual-123',
      username: '',
      product: 'Pet Water Fountain',
      currentStatus: 'To Contact',
      sampleShippingStatus: 'Not Shipped',
      videoProgress: '0 of 2',
      lastFollowUpCount: 0,
      notes: '',
    });
  });

  it('updates edited creator fields and keeps safe video progress text for export', () => {
    const edited = updateCreatorField(row(), 'videoProgress', '2 of 2');

    expect(edited.videoProgress).toBe('2 of 2');
    expect(edited.videoProgressWarning).toBeUndefined();
    expect(updateCreatorField(row(), 'lastFollowUpCount', '3').lastFollowUpCount).toBe(3);
    expect(updateCreatorField(row(), 'lastFollowUpCount', '').lastFollowUpCount).toBe(0);
  });

  it('exports the current rows with the original template column structure', () => {
    const csv = creatorRowsToCsv([
      row({ username: 'creator, one', notes: 'Line 1\nLine 2' }),
    ]);

    expect(csv.split('\n')[0]).toBe('Creator username,Creator profile link,Contact method,Product,Current status,Sample shipping status,Sample delivered date,Video progress,First video posted date,Last contact date,Last follow-up count,Notes');
    expect(csv).toContain('"creator, one"');
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it('normalizes saved filming requirements', () => {
    const saved = saveFilmingRequirements({
      productName: '  Pet Dryer  ',
      videoCount: 3,
      videoDurationRequirement: '  每条视频 45 秒以上 ',
      brandTagRequirement: ' tag @brand ',
      productLinkRequirement: ' add product link ',
      keyContentPoints: [' Show airflow ', '', 'Easy cleanup'],
    });

    expect(saved).toMatchObject({
      productName: 'Pet Dryer',
      videoCount: 3,
      videoDurationRequirement: '每条视频 45 秒以上',
      keyContentPoints: ['Show airflow', 'Easy cleanup'],
    });
  });
});
