import type { CreatorRow } from "./types";
import { normalizeText, normalizeVideoProgress } from "./sopRules";
import {
  DEFAULT_STORE_NAME,
  normalizeStoreId,
  normalizeStoreName,
  campaignIdFromName,
  productIdForCampaign,
} from "./campaignData";

const COLUMN_ALIASES: Record<
  keyof Omit<
    CreatorRow,
    | "id"
    | "storeId"
    | "campaignId"
    | "productId"
    | "lastFollowUpCount"
    | "videoProgressWarning"
    | "followUpHistory"
    | "archivedAt"
    | "archiveReason"
    | "round"
  >,
  string[]
> = {
  username: [
    "creator username",
    "达人昵称",
    "达人名称",
    "达人",
    "昵称",
    "tiktok账号",
    "tiktok handle",
    "creator name",
    "handle",
    "username",
    "creator",
    "creator handle",
    "达人账号",
  ],
  profileLink: [
    "creator profile link",
    "profile link",
    "creator link",
    "profile",
    "主页链接",
  ],
  contactMethod: [
    "contact method",
    "contact",
    "channel",
    "联系渠道",
    "沟通渠道",
    "联系方式",
  ],
  storeName: [
    "店铺 / 品牌",
    "店铺",
    "品牌",
    "店铺名称",
    "所属店铺",
    "store",
    "brand",
    "shop",
    "store name",
  ],
  product: [
    "product",
    "product name",
    "product Name",
    "产品",
    "产品名称",
    "所属产品",
    "产品项目",
  ],
  currentStatus: [
    "current status",
    "status",
    "creator status",
    "合作状态",
    "当前状态",
  ],
  sampleShippingStatus: [
    "sample shipping status",
    "shipping status",
    "sample status",
    "物流状态",
    "样品物流状态",
  ],
  sampleDeliveredDate: [
    "sample delivered date",
    "sample arrival date",
    "estimated arrival date",
    "estimated delivery date",
    "expected delivery date",
    "eta",
    "delivered date",
    "delivery date",
    "样品到货日期",
    "样品到货时间",
    "预计到货日期",
  ],
  videoProgress: [
    "video progress",
    "videos",
    "progress",
    "视频进度",
    "发布进度",
    "已发视频",
    "视频数量",
  ],
  firstVideoPostedDate: [
    "first video posted date",
    "first video date",
    "video 1 date",
    "首条视频发布日期",
    "首条视频发布时间",
  ],
  latestVideoPostedDate: [
    "latest video posted date",
    "last video posted date",
    "最近视频发布日期",
  ],
  lastContactDate: [
    "last contact date",
    "last contacted date",
    "contacted date",
    "最近联系日期",
    "最后联系时间",
    "last message sent at",
  ],
  notes: ["notes", "note", "remarks", "备注", "达人备注", "说明", "备注信息"],
  trackingStatus: [
    "tracking status",
    "follow-up tracking status",
    "follow up tracking status",
    "跟进状态",
  ],
  lastMessageScenario: ["last message scenario", "最近沟通动作"],
  lastMessageChannel: ["last message channel", "最近沟通渠道"],
  lastMessageSentAt: ["last message sent at"],
  lastHandledDate: ["last handled date", "最近处理日期"],
  nextFollowUpDate: [
    "next follow-up date",
    "next follow up date",
    "下次跟进日期",
  ],
  lastCreatorResponse: [
    "last creator response",
    "达人回复/下一步备注",
    "达人回复",
    "下一步备注",
  ],
};

const FOLLOW_UP_ALIASES = [
  "last follow-up count",
  "last follow up count",
  "follow-up count",
  "follow up count",
  "followups",
  "跟进次数",
];

/**
 * Header text as typed in a spreadsheet is rarely clean: a byte-order mark from
 * an exported file, a line break from Alt+Enter, full-width punctuation from a
 * Chinese keyboard, an underscore or hyphen instead of a space. None of those
 * change what the column means, so they are all stripped before matching.
 *
 * Spaces go too, which is what lets "达人 账号" match "达人账号" — Chinese column
 * names are frequently written with a space that carries no meaning.
 */
function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[_\-—–]/g, "")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .replace(/[：:]/g, ":")
    .replace(/[／/]/g, "/")
    .trim();
}

/** Aliases are written readably in the map, so normalize both sides to compare. */
function headerMatches(header: string, aliases: string[]): boolean {
  const normalized = normalizeHeader(header);
  return aliases.some((alias) => normalizeHeader(alias) === normalized);
}

function pickValue(record: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(record);
  const found = entries.find(([key]) => headerMatches(key, aliases));
  return normalizeText(found?.[1]);
}

export function normalizeRecord(
  record: Record<string, unknown>,
  index: number,
  requiredVideos = 1,
  fallbackStoreName = DEFAULT_STORE_NAME,
): CreatorRow {
  const lastFollowUpValue = pickValue(record, FOLLOW_UP_ALIASES);
  const followUpCount = Number.parseInt(lastFollowUpValue || "0", 10);
  const progressResult = normalizeVideoProgress(
    pickValue(record, COLUMN_ALIASES.videoProgress),
    requiredVideos,
  );
  const lastMessageSentAt = pickValue(record, COLUMN_ALIASES.lastMessageSentAt);
  const lastContactDate =
    pickValue(record, COLUMN_ALIASES.lastContactDate) || lastMessageSentAt;
  const storeName = normalizeStoreName(
    pickValue(record, COLUMN_ALIASES.storeName) || fallbackStoreName,
  );
  const storeId = normalizeStoreId(undefined, storeName);
  const product = pickValue(record, COLUMN_ALIASES.product);
  const campaignId = campaignIdFromName(product);

  return {
    id: `${index}-${pickValue(record, COLUMN_ALIASES.username) || "creator"}`,
    username:
      pickValue(record, COLUMN_ALIASES.username) || `Creator ${index + 1}`,
    profileLink: pickValue(record, COLUMN_ALIASES.profileLink),
    contactMethod: pickValue(record, COLUMN_ALIASES.contactMethod),
    storeId,
    storeName,
    campaignId,
    productId: productIdForCampaign(storeId, campaignId),
    product,
    currentStatus: pickValue(record, COLUMN_ALIASES.currentStatus),
    sampleShippingStatus: pickValue(
      record,
      COLUMN_ALIASES.sampleShippingStatus,
    ),
    sampleDeliveredDate: pickValue(record, COLUMN_ALIASES.sampleDeliveredDate),
    videoProgress: progressResult.normalized,
    videoProgressWarning: progressResult.warning,
    firstVideoPostedDate: pickValue(
      record,
      COLUMN_ALIASES.firstVideoPostedDate,
    ),
    latestVideoPostedDate: pickValue(
      record,
      COLUMN_ALIASES.latestVideoPostedDate,
    ),
    lastContactDate,
    lastFollowUpCount: Number.isNaN(followUpCount) ? 0 : followUpCount,
    notes: pickValue(record, COLUMN_ALIASES.notes),
    trackingStatus: pickValue(record, COLUMN_ALIASES.trackingStatus),
    lastMessageScenario: pickValue(record, COLUMN_ALIASES.lastMessageScenario),
    lastMessageChannel: pickValue(record, COLUMN_ALIASES.lastMessageChannel),
    lastMessageSentAt,
    lastHandledDate: pickValue(record, COLUMN_ALIASES.lastHandledDate),
    nextFollowUpDate: pickValue(record, COLUMN_ALIASES.nextFollowUpDate),
    lastCreatorResponse: pickValue(record, COLUMN_ALIASES.lastCreatorResponse),
    followUpHistory: [],
  };
}

/** What the parser understood about the file, so the UI can explain itself. */
export type ImportReport = {
  sheetName: string;
  sheetCount: number;
  /** 1-based row the headers were found on; > 1 means title rows were skipped. */
  headerRow: number;
  matchedColumns: string[];
  unmatchedColumns: string[];
  dataRowCount: number;
  encoding?: string;
};

export type ParsedCreatorFile = {
  rows: CreatorRow[];
  report: ImportReport;
};

const ALL_ALIAS_GROUPS: string[][] = [
  ...Object.values(COLUMN_ALIASES),
  FOLLOW_UP_ALIASES,
];

function headerIsKnown(header: string): boolean {
  return ALL_ALIAS_GROUPS.some((aliases) => headerMatches(header, aliases));
}

/**
 * Reads the bytes as text, honouring whatever the exporting program used.
 *
 * Excel on a Chinese Windows writes CSV as GBK, and its "Unicode text" option
 * writes UTF-16 — decoding either as UTF-8 turns every header into mojibake, so
 * no column matches and every creator imports as "Creator 1". A byte-order mark
 * settles it when present; otherwise UTF-8 is tried strictly and GBK is the
 * fallback, which is the pair that actually shows up in practice.
 */
function decodeText(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return {
      text: new TextDecoder("utf-16le").decode(buffer),
      encoding: "UTF-16LE",
    };
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return {
      text: new TextDecoder("utf-16be").decode(buffer),
      encoding: "UTF-16BE",
    };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return {
      text: new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, ""),
      encoding: "UTF-8",
    };

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      encoding: "UTF-8",
    };
  } catch {
    return { text: new TextDecoder("gbk").decode(buffer), encoding: "GBK" };
  }
}

/** xlsx and xls are containers, not text; trust the bytes over the extension. */
function looksBinary(bytes: Uint8Array): boolean {
  const zip =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  const oleCompoundFile =
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;
  return zip || oleCompoundFile;
}

type Grid = unknown[][];

/**
 * A real date cell in a workbook arrives as a Date. Excel stores dates without
 * a timezone, so the conversion can land a millisecond either side of midnight
 * — rounding to the nearest day keeps the calendar date right wherever the
 * import runs.
 */
function cellToText(cell: unknown): string {
  if (cell instanceof Date) {
    const dayMs = 86_400_000;
    return new Date(Math.round(cell.getTime() / dayMs) * dayMs)
      .toISOString()
      .slice(0, 10);
  }
  return String(cell ?? "");
}

/**
 * Real workbooks open on a cover or instructions tab as often as on the data,
 * so pick the sheet with the most recognisable headers rather than the first.
 */
function pickSheet(
  sheetNames: string[],
  gridOf: (name: string) => Grid,
): { name: string; grid: Grid } {
  let best = { name: sheetNames[0] ?? "", grid: [] as Grid, score: -1 };

  for (const name of sheetNames) {
    const grid = gridOf(name);
    const known = grid
      .slice(0, 20)
      .reduce(
        (total, row) =>
          Math.max(
            total,
            row.filter((cell) => headerIsKnown(String(cell ?? ""))).length,
          ),
        0,
      );
    const score = known * 1000 + grid.length;
    if (score > best.score) best = { name, grid, score };
  }

  return { name: best.name, grid: best.grid };
}

/**
 * Finds the row the table actually starts on. Spreadsheets kept by hand often
 * open with a title like "8月达人合作表" and a blank line before the headers; if
 * the title is taken for the header row, every column goes unrecognised.
 *
 * The header is the row in the first stretch of the sheet that matches the most
 * known column names. Falling back to the first non-empty row keeps unfamiliar
 * files working the way they did before.
 */
function findHeaderRow(grid: Grid): number {
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < Math.min(grid.length, 20); index += 1) {
    const score = (grid[index] ?? []).filter((cell) =>
      headerIsKnown(String(cell ?? "")),
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex >= 0) return bestIndex;
  return grid.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim() !== ""),
  );
}

function gridToRecords(
  grid: Grid,
  headerRow: number,
): { records: Record<string, unknown>[]; headers: string[] } {
  const headers = (grid[headerRow] ?? []).map(cellToText);
  const records: Record<string, unknown>[] = [];

  for (let index = headerRow + 1; index < grid.length; index += 1) {
    const row = grid[index] ?? [];
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue;
    const record: Record<string, unknown> = {};
    headers.forEach((header, column) => {
      if (header.trim()) record[header] = cellToText(row[column]);
    });
    records.push(record);
  }

  return { records, headers };
}

export async function parseCreatorFile(
  file: File,
  requiredVideos = 1,
  fallbackStoreName = DEFAULT_STORE_NAME,
): Promise<ParsedCreatorFile> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) throw new Error("这个文件是空的，请检查后重新导出。");

  const XLSX = await import("xlsx");
  const binary = looksBinary(bytes);
  let encoding: string | undefined;
  let workbook;

  if (binary) {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } else {
    const decoded = decodeText(buffer);
    encoding = decoded.encoding;
    // Without raw, the CSV reader guesses types: "2026-08-05" becomes an Excel
    // serial number and "0/2" is read as a date, so both arrive as meaningless
    // floats. Keeping the text as written is what the field parsers expect.
    workbook = XLSX.read(decoded.text, { type: "string", raw: true });
  }

  const gridOf = (name: string): Grid =>
    XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: "",
      blankrows: false,
    });

  const { name: sheetName, grid } = pickSheet(workbook.SheetNames, gridOf);
  const headerRow = findHeaderRow(grid);

  if (headerRow < 0) {
    throw new Error(
      `「${sheetName}」这个工作表是空的。请确认数据在这张表里，或删掉多余的空表。`,
    );
  }

  const { records, headers } = gridToRecords(grid, headerRow);
  const usable = headers.filter((header) => header.trim());
  const report: ImportReport = {
    sheetName,
    sheetCount: workbook.SheetNames.length,
    headerRow: headerRow + 1,
    matchedColumns: usable.filter(headerIsKnown),
    unmatchedColumns: usable.filter((header) => !headerIsKnown(header)),
    dataRowCount: records.length,
    encoding,
  };

  return {
    rows: records.map((record, index) =>
      normalizeRecord(record, index, requiredVideos, fallbackStoreName),
    ),
    report,
  };
}
