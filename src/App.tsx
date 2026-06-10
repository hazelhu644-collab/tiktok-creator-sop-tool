import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  clearSavedCreatorRows,
  createBlankCreatorRow,
  deleteCreatorRow,
  downloadCreatorRowsCsv,
  loadCreatorRows,
  saveCreatorRows,
  updateCreatorField,
  type EditableCreatorField,
} from './creatorData';
import { parseCreatorFile } from './fileParser';
import { analyzeCreators, daysSince, normalizeVideoProgress, parseRequiredVideos } from './sopRules';
import { CHANNELS, defaultCreatorFilmingRequirements, generateMessage, type CreatorFilmingRequirements } from './messageGenerator';
import { campaignToFilmingRequirements, createCampaignFromName, loadCampaigns, mergeDetectedCampaigns, saveCampaigns } from './campaignData';
import type { Campaign, Channel, CreatorRow, GeneratedMessage, Task } from './types';
import './styles.css';

const FILMING_REQUIREMENTS_STORAGE_KEY = 'tiktokCreatorSop.filmingRequirements';

const creatorStatuses = [
  'Not Contacted',
  'Invited',
  'Replied',
  'Sample Requested',
  'Sample Approved',
  'Sample Shipped',
  'Delivered',
  'Waiting Video',
  'Posted',
  'Need Revision',
  'Product Tag Missing',
  'Ready for Ads',
  'Spark Ads Requested',
  'Completed',
  'Lost',
] as const;

type CreatorStatus = typeof creatorStatuses[number];
type ModuleKey = 'dashboard' | 'creators' | 'templates' | 'samples' | 'followup' | 'review' | 'ads' | 'settings';
type Toast = { tone: 'success' | 'warning'; text: string } | null;

type TemplateForm = {
  creatorName: string;
  productName: string;
  sellingPoint: string;
  requirement: string;
  length: string;
  videos: string;
  tagRequirement: string;
  trackingNumber: string;
  deadline: string;
};

const emptyTemplateForm: TemplateForm = {
  creatorName: '',
  productName: defaultCreatorFilmingRequirements.productName,
  sellingPoint: '',
  requirement: 'Show a real pet using the product, clear unboxing/use process, CTA, and TikTok Shop product card.',
  length: '40s+',
  videos: '2',
  tagRequirement: 'Attach the TikTok Shop product card before publishing.',
  trackingNumber: '',
  deadline: '',
};

const statusLabels: Record<CreatorStatus, string> = {
  'Not Contacted': '未联系',
  Invited: '已邀约',
  Replied: '已回复',
  'Sample Requested': '申请样品',
  'Sample Approved': '样品已通过',
  'Sample Shipped': '样品已寄出',
  Delivered: '样品已签收',
  'Waiting Video': '等待视频',
  Posted: '已发布',
  'Need Revision': '需修改',
  'Product Tag Missing': '未挂商品卡',
  'Ready for Ads': '可投流',
  'Spark Ads Requested': '已申请 Spark Ads',
  Completed: '合作完成',
  Lost: '合作失败',
};

const templateFieldLabels: Record<keyof TemplateForm, string> = {
  creatorName: '达人名称',
  productName: '产品名称',
  sellingPoint: '产品卖点',
  requirement: '拍摄要求',
  length: '视频时长',
  videos: '视频数量',
  tagRequirement: '挂车 / Tag 要求',
  trackingNumber: '物流单号',
  deadline: '截止时间',
};

type TemplateMessage = {
  name: string;
  english: string;
  chinese: string;
};

const navIcons: Record<ModuleKey, string> = { dashboard: '⌁', creators: '◌', templates: '✦', samples: '◇', followup: '↗', review: '✓', ads: '◆', settings: '⚙' };

const navItems: Array<{ key: ModuleKey; label: string; helper: string }> = [
  { key: 'dashboard', label: '数据看板', helper: '今日跟进总览' },
  { key: 'creators', label: '达人数据库', helper: '搜索、筛选、批量更新' },
  { key: 'templates', label: '沟通话术模板', helper: '变量化话术生成器' },
  { key: 'samples', label: '样品追踪', helper: '物流与到货跟进' },
  { key: 'followup', label: '达人跟进中心', helper: '优先级行动队列' },
  { key: 'review', label: '内容审核', helper: '视频验收清单' },
  { key: 'ads', label: '投流素材库', helper: '可投流 UGC 素材' },
  { key: 'settings', label: '设置', helper: '数据与 SOP 默认值' },
];

function loadFilmingRequirements(): CreatorFilmingRequirements {
  if (typeof window === 'undefined') return defaultCreatorFilmingRequirements;

  const savedRequirements = window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY);
  if (!savedRequirements) return defaultCreatorFilmingRequirements;

  try {
    const parsedRequirements = JSON.parse(savedRequirements) as Partial<CreatorFilmingRequirements>;
    return {
      productName: typeof parsedRequirements.productName === 'string' && parsedRequirements.productName.trim()
        ? parsedRequirements.productName
        : defaultCreatorFilmingRequirements.productName,
      requirements: Array.isArray(parsedRequirements.requirements) ? parsedRequirements.requirements.filter(Boolean) : defaultCreatorFilmingRequirements.requirements,
      keyContentPoints: Array.isArray(parsedRequirements.keyContentPoints) ? parsedRequirements.keyContentPoints.filter(Boolean) : defaultCreatorFilmingRequirements.keyContentPoints,
      referenceLinks: Array.isArray(parsedRequirements.referenceLinks) ? parsedRequirements.referenceLinks.filter(Boolean) : [],
    };
  } catch {
    return defaultCreatorFilmingRequirements;
  }
}

function saveFilmingRequirements(requirements: CreatorFilmingRequirements) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify(requirements));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeListText(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function listToText(value: string[] | undefined): string {
  return (value ?? []).join('\n');
}

function displayName(row: Pick<CreatorRow, 'username'>): string {
  return row.username.trim() || '未命名达人';
}

function displayStatus(status: CreatorStatus): string {
  return statusLabels[status] ?? status;
}

function containsChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function outgoingEnglishValue(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed || containsChinese(trimmed)) return fallback;
  return trimmed;
}

function safeLower(value: string | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function hasAny(value: string, terms: string[]) {
  const normalized = safeLower(value);
  return terms.some((term) => normalized.includes(term));
}

function inferStatus(row: CreatorRow, requiredVideos: number): CreatorStatus {
  const status = safeLower(row.currentStatus);
  const shipping = safeLower(row.sampleShippingStatus);
  const progress = normalizeVideoProgress(row.videoProgress, requiredVideos);
  const notes = safeLower(row.notes);
  const tracking = safeLower(row.trackingStatus);

  if (hasAny(status, ['lost', 'failed', 'cancel', '失败']) || tracking === 'failed') return 'Lost';
  if (hasAny(status, ['completed', 'complete', '已完成']) || tracking === 'completed') return 'Completed';
  if (hasAny(status, ['spark'])) return 'Spark Ads Requested';
  if (hasAny(status, ['ready for ads']) || hasAny(notes, ['ready for ads', 'high ctr', '投流'])) return 'Ready for Ads';
  if (hasAny(status, ['tag missing']) || hasAny(notes, ['product tag missing', 'missing product card', '未挂'])) return 'Product Tag Missing';
  if (hasAny(status, ['revision', 'revise', '修改'])) return 'Need Revision';
  if ((progress.postedCount ?? 0) > 0 || hasAny(status, ['posted'])) return 'Posted';
  if (hasAny(status, ['waiting video', 'waiting for video'])) return 'Waiting Video';
  if (shipping === 'delivered' || Boolean(row.sampleDeliveredDate.trim()) || hasAny(status, ['delivered'])) return 'Delivered';
  if (hasAny(shipping, ['shipped', 'in transit']) || hasAny(status, ['sample shipped', 'in transit'])) return 'Sample Shipped';
  if (hasAny(status, ['approved'])) return 'Sample Approved';
  if (hasAny(status, ['sample requested', 'requested'])) return 'Sample Requested';
  if (hasAny(status, ['replied']) || tracking === 'replied' || tracking === 'reply pending') return 'Replied';
  if (hasAny(status, ['invited', 'contacted', 'followed up']) || tracking === 'followed up') return 'Invited';
  return 'Not Contacted';
}

function statusTone(status: CreatorStatus) {
  return `status-pill status-${status.toLowerCase().replace(/\s+/g, '-')}`;
}

function parseNumberFromNotes(notes: string, keys: string[]): string {
  for (const key of keys) {
    const expression = new RegExp(`${key}\\s*[:：]\\s*([^,;\\n]+)`, 'i');
    const match = notes.match(expression);
    if (match?.[1]) return match[1].trim();
  }
  return '—';
}

function creatorType(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, ['niche', 'creator type', 'type']) === '—' ? 'Pet / UGC' : parseNumberFromNotes(row.notes, ['niche', 'creator type', 'type']);
}

function followerCount(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, ['followers', 'follower count', '粉丝']);
}

function avgViews(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, ['avg views', 'average views', '播放']);
}

function gmvRange(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, ['gmv', 'gmv range']);
}

function daysDelivered(row: CreatorRow) {
  return row.sampleDeliveredDate ? daysSince(row.sampleDeliveredDate) : null;
}

function sampleHint(row: CreatorRow, requiredVideos: number) {
  const status = inferStatus(row, requiredVideos);
  const deliveredDays = daysDelivered(row);
  const progress = normalizeVideoProgress(row.videoProgress, requiredVideos);

  if (status === 'Sample Shipped') return '已寄出但未签收：确认物流是否卡住。';
  if (status === 'Delivered' && deliveredDays !== null && deliveredDays >= 5 && (progress.postedCount ?? 0) === 0) return '已签收 5 天未发布：催发视频并确认拍摄计划。';
  if (status === 'Delivered' && deliveredDays !== null && deliveredDays >= 3) return '已签收 3 天未回复：发送签收后跟进。';
  if (status === 'Lost') return '达人取消合作：确认是否需退样。';
  return '按下一次跟进日期复查。';
}

function buildTemplateMessages(form: TemplateForm): TemplateMessage[] {
  const creator = outgoingEnglishValue(form.creatorName, '[Creator Name]');
  const product = outgoingEnglishValue(form.productName, '[Product Name]');
  const sellingPoint = outgoingEnglishValue(form.sellingPoint, '[Product Selling Point]');
  const requirement = outgoingEnglishValue(form.requirement, '[Video Requirement]');
  const length = outgoingEnglishValue(form.length, '[Video Length]');
  const videos = outgoingEnglishValue(form.videos, '[Number of Videos]');
  const tag = outgoingEnglishValue(form.tagRequirement, '[Product Tag Requirement]');
  const tracking = outgoingEnglishValue(form.trackingNumber, '[Tracking Number]');
  const deadline = outgoingEnglishValue(form.deadline, '[Deadline]');

  return [
    {
      name: '初次邀约',
      english: `Hi ${creator}, we love your pet content and would like to invite you to collaborate on ${product}. Key selling point: ${sellingPoint}. The requirement is ${videos} video(s), ${length}, with ${tag}. Are you open to receiving a sample?`,
      chinese: `向 ${creator} 发起首次合作邀约，说明 ${product} 的核心卖点、视频数量、时长和挂车要求，并询问是否愿意收样。`,
    },
    {
      name: '达人同意合作',
      english: `Amazing, ${creator}! For ${product}, please cover: ${requirement}. Please keep each video ${length}, publish ${videos} video(s), and ${tag}. Deadline target: ${deadline}.`,
      chinese: `达人同意合作后，确认 ${product} 的拍摄要求、视频时长、视频数量、挂车要求和目标截止时间。`,
    },
    {
      name: '样品已寄出',
      english: `Your ${product} sample has been shipped. Tracking number: ${tracking}. Once it arrives, please test it with a real pet scene and share your posting plan.`,
      chinese: `通知达人样品已寄出，提供物流单号，并提醒签收后在真实宠物场景中测试产品、反馈发布计划。`,
    },
    {
      name: '样品已签收跟进',
      english: `Hi ${creator}, tracking shows the ${product} sample was delivered. Could you confirm you received it and let us know your filming schedule?`,
      chinese: `物流显示已签收后，确认达人是否收到 ${product}，并推进达人给出拍摄排期。`,
    },
    {
      name: '催发视频',
      english: `Hi ${creator}, just checking in on the ${product} video(s). The target is ${videos} video(s) by ${deadline}. Please let us know if you need anything before posting.`,
      chinese: `达人已收样但视频未发布时，提醒 ${videos} 条视频和 ${deadline} 截止时间，同时保留支持口径。`,
    },
    {
      name: '提醒挂商品卡',
      english: `Thanks for posting! One important fix: please attach the TikTok Shop product card for ${product}. ${tag}`,
      chinese: `达人已发布但未挂商品卡时，提醒其为 ${product} 补挂 TikTok Shop 商品卡。`,
    },
    {
      name: '要求修改视频',
      english: `Thanks for the draft/post. Could you revise it to include: ${requirement}. Please also keep it ${length} and avoid unsupported claims.`,
      chinese: `视频草稿或已发布内容不符合要求时，清楚说明需要补充的拍摄点、时长要求和合规风险。`,
    },
    {
      name: '索要 Spark Ads 授权',
      english: `This video looks strong for paid boosting. Could you grant Spark Ads authorization / ad code for the ${product} post?`,
      chinese: `视频表现适合投流时，向达人索要 ${product} 内容的 Spark Ads 授权或广告码。`,
    },
    {
      name: '合作取消',
      english: `Understood. We will cancel this collaboration for ${product}. Please confirm no further posts will be made under this campaign.`,
      chinese: `合作终止时，确认取消 ${product} 合作，并要求达人不要继续发布该 campaign 下的内容。`,
    },
    {
      name: '要求退回样品',
      english: `Since the collaboration is cancelled, please return the ${product} sample. We can share the return details and next steps.`,
      chinese: `合作取消且需要追回样品时，说明需退回 ${product} 样品，并表示会提供退回信息。`,
    },
  ];
} 

function App() {
  const [rows, setRows] = useState<CreatorRow[]>(() => loadCreatorRows());
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CreatorStatus | 'All'>('All');
  const [creatorTypeFilter, setCreatorTypeFilter] = useState('All');
  const [followerFilter, setFollowerFilter] = useState('All');
  const [avgViewsFilter, setAvgViewsFilter] = useState('All');
  const [gmvFilter, setGmvFilter] = useState('All');
  const [bulkStatus, setBulkStatus] = useState<CreatorStatus>('Invited');
  const [channel, setChannel] = useState<Channel>('TikTok DM');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [message, setMessage] = useState<GeneratedMessage | null>(null);
  const [trackingStatus, setTrackingStatus] = useState('');
  const [templateForm, setTemplateForm] = useState<TemplateForm>(() => emptyTemplateForm);
  const [filmingRequirements, setFilmingRequirements] = useState<CreatorFilmingRequirements>(() => loadFilmingRequirements());
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());
  const [selectedCampaign, setSelectedCampaign] = useState('ALL');
  const [isEditingFilmingRequirements, setIsEditingFilmingRequirements] = useState(false);
  const [filmingProductNameDraft, setFilmingProductNameDraft] = useState(() => defaultCreatorFilmingRequirements.productName);
  const [filmingRequirementsDraft, setFilmingRequirementsDraft] = useState(() => listToText(defaultCreatorFilmingRequirements.requirements));
  const [keyContentPointsDraft, setKeyContentPointsDraft] = useState(() => listToText(defaultCreatorFilmingRequirements.keyContentPoints));
  const [referenceLinksDraft, setReferenceLinksDraft] = useState(() => listToText(defaultCreatorFilmingRequirements.referenceLinks));
  const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
  const [promptHelperForm, setPromptHelperForm] = useState({ sellingPoints: '', videoCount: '', durationRequirement: '', targetPetOrScene: '', mustShowShots: '', avoidShots: '', referenceLinks: '' });
  const [generatedChatGptPrompt, setGeneratedChatGptPrompt] = useState('');
  const [promptCopyStatus, setPromptCopyStatus] = useState('');

  const mergedCampaigns = useMemo(() => mergeDetectedCampaigns(campaigns, rows, filmingRequirements), [campaigns, rows, filmingRequirements]);
  const activeCampaign = selectedCampaign === 'ALL' ? undefined : mergedCampaigns.find((campaign) => campaign.productName === selectedCampaign);
  const activeFilmingRequirements = useMemo(() => campaignToFilmingRequirements(activeCampaign, filmingRequirements), [activeCampaign, filmingRequirements]);
  const requiredVideos = useMemo(() => parseRequiredVideos(activeFilmingRequirements), [activeFilmingRequirements]);
  const visibleRows = useMemo(() => selectedCampaign === 'ALL' ? rows : rows.filter((row) => row.product.trim() === selectedCampaign), [rows, selectedCampaign]);
  const tasks = useMemo(() => analyzeCreators(visibleRows, undefined, requiredVideos), [visibleRows, requiredVideos]);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const selectedTask = tasks.find((task) => task.id === selectedCreatorId) ?? tasks[0];
  const templateMessages = useMemo(() => buildTemplateMessages(templateForm), [templateForm]);

  useEffect(() => saveCreatorRows(rows), [rows]);
  useEffect(() => saveCampaigns(mergedCampaigns), [mergedCampaigns]);
  useEffect(() => {
    if (selectedCampaign !== 'ALL' && !mergedCampaigns.some((campaign) => campaign.productName === selectedCampaign)) setSelectedCampaign('ALL');
  }, [mergedCampaigns, selectedCampaign]);
  useEffect(() => {
    const target = activeCampaign ?? mergedCampaigns[0];
    if (!target) return;
    setTemplateForm((form) => ({
      ...form,
      productName: target.productName,
      sellingPoint: target.sellingPoints,
      requirement: [...target.requirements, ...target.keyContentPoints].filter(Boolean).join('; '),
      length: target.videoLength || form.length,
      videos: target.videoCount || String(parseRequiredVideos(campaignToFilmingRequirements(target, filmingRequirements))),
      tagRequirement: target.tagRequirement || form.tagRequirement,
    }));
  }, [activeCampaign, mergedCampaigns, filmingRequirements]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const enrichedRows = useMemo(() => visibleRows.map((row) => ({
    row,
    task: tasksById.get(row.id),
    status: inferStatus(row, requiredVideos),
    creatorType: creatorType(row),
    followers: followerCount(row),
    avgViews: avgViews(row),
    gmv: gmvRange(row),
  })), [visibleRows, tasksById, requiredVideos]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return enrichedRows.filter((entry) => {
      const haystack = [entry.row.username, entry.row.profileLink, entry.row.product, entry.row.currentStatus, entry.row.sampleShippingStatus, entry.row.notes, entry.status].join(' ').toLowerCase();
      return (!normalized || haystack.includes(normalized))
        && (statusFilter === 'All' || entry.status === statusFilter)
        && (creatorTypeFilter === 'All' || entry.creatorType.toLowerCase().includes(creatorTypeFilter.toLowerCase()))
        && (followerFilter === 'All' || entry.followers.includes(followerFilter))
        && (avgViewsFilter === 'All' || entry.avgViews.includes(avgViewsFilter))
        && (gmvFilter === 'All' || entry.gmv.toLowerCase().includes(gmvFilter.toLowerCase()));
    });
  }, [enrichedRows, search, statusFilter, creatorTypeFilter, followerFilter, avgViewsFilter, gmvFilter]);

  const todayTodo = useMemo(() => tasks
    .filter((task) => task.needsFollowUp || task.failedWarnings.length > 0 || inferStatus(task, requiredVideos) === 'Product Tag Missing' || inferStatus(task, requiredVideos) === 'Ready for Ads')
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .slice(0, 12), [tasks, requiredVideos]);

  const dashboardCards: Array<{ label: string; value: number; status?: CreatorStatus; filter?: (row: CreatorRow) => boolean }> = [
    { label: '今日待邀约达人数量', value: enrichedRows.filter((entry) => entry.status === 'Not Contacted').length, status: 'Not Contacted' },
    { label: '今日待跟进达人数量', value: tasks.filter((task) => task.needsFollowUp).length, filter: (row) => Boolean(tasksById.get(row.id)?.needsFollowUp) },
    { label: '待寄样达人数量', value: enrichedRows.filter((entry) => ['Sample Requested', 'Sample Approved'].includes(entry.status)).length, status: 'Sample Requested' },
    { label: '已寄样待签收数量', value: enrichedRows.filter((entry) => entry.status === 'Sample Shipped').length, status: 'Sample Shipped' },
    { label: '已签收待发视频数量', value: enrichedRows.filter((entry) => ['Delivered', 'Waiting Video'].includes(entry.status)).length, status: 'Delivered' },
    { label: '本周已发布视频数量', value: enrichedRows.filter((entry) => entry.status === 'Posted').length, status: 'Posted' },
    { label: '待验收视频数量', value: enrichedRows.filter((entry) => ['Posted', 'Need Revision', 'Product Tag Missing'].includes(entry.status)).length, status: 'Posted' },
    { label: '可投流素材数量', value: enrichedRows.filter((entry) => ['Ready for Ads', 'Spark Ads Requested'].includes(entry.status)).length, status: 'Ready for Ads' },
  ];

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setError('');
      const parsedRows = await parseCreatorFile(file, requiredVideos);
      setRows(parsedRows);
      setFileName(file.name);
      setSelectedIds([]);
      setToast({ tone: 'success', text: '导入成功，已刷新工作台数据。' });
      if (parsedRows.length === 0) setError('没有找到达人数据。请检查表头和表格内容。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法解析该文件。');
    }
  }

  function updateRow(rowId: string, field: EditableCreatorField, value: string) {
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? updateCreatorField(row, field, value, requiredVideos) : row)));
    setMessage(null);
  }

  function handleDashboardCardClick(card: typeof dashboardCards[number]) {
    setActiveModule('creators');
    setSearch('');
    setStatusFilter(card.status ?? 'All');
    if (!card.status && card.filter) {
      const matchingIds = rows.filter(card.filter).map((row) => row.id);
      setSelectedIds(matchingIds);
    }
  }

  function handleAddCreator() {
    const choice = window.prompt('所属产品（输入现有产品名称，或输入新产品项目名称）：', selectedCampaign === 'ALL' ? (mergedCampaigns[0]?.productName ?? filmingRequirements.productName) : selectedCampaign);
    const productName = (choice?.trim() || (selectedCampaign === 'ALL' ? mergedCampaigns[0]?.productName : selectedCampaign) || filmingRequirements.productName);
    if (!mergedCampaigns.some((campaign) => campaign.productName === productName)) setCampaigns((current) => [...current, createCampaignFromName(productName, filmingRequirements)]);
    const newRow = createBlankCreatorRow(productName, requiredVideos);
    setRows((currentRows) => [newRow, ...currentRows]);
    setSelectedCreatorId(newRow.id);
    setActiveModule('creators');
    setToast({ tone: 'success', text: '已新增达人，可直接编辑表格字段。' });
  }

  function toggleSelected(rowId: string) {
    setSelectedIds((ids) => (ids.includes(rowId) ? ids.filter((id) => id !== rowId) : [...ids, rowId]));
  }

  function toggleSelectAll(event: ChangeEvent<HTMLInputElement>) {
    setSelectedIds(event.target.checked ? filteredRows.map((entry) => entry.row.id) : []);
  }

  function applyStatusToRows(ids: string[], status: CreatorStatus) {
    setRows((currentRows) => currentRows.map((row) => (ids.includes(row.id) ? { ...row, currentStatus: status } : row)));
    setToast({ tone: 'success', text: `已更新 ${ids.length} 位达人状态为 ${displayStatus(status)}。` });
  }

  function handleBulkStatusUpdate() {
    if (selectedIds.length === 0) return;
    applyStatusToRows(selectedIds, bulkStatus);
  }

  async function copyText(text: string, successText = '复制成功。') {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: 'success', text: successText });
    } catch {
      setToast({ tone: 'warning', text: '复制失败，请手动复制。' });
    }
  }

  function buildOutreachForRow(row: CreatorRow) {
    const campaignRequirements = campaignToFilmingRequirements(mergedCampaigns.find((campaign) => campaign.productName === row.product), filmingRequirements);
    const product = outgoingEnglishValue(row.product || campaignRequirements.productName, '[Product Name]');
    const creator = outgoingEnglishValue(displayName(row), '[Creator Name]').replace(/^@/, '');
    const greetingName = creator.startsWith('[') ? creator : `@${creator}`;
    return `Hi ${greetingName}, we love your TikTok pet content and would like to invite you to collaborate on ${product}. Are you open to receiving a sample and creating ${parseRequiredVideos(campaignRequirements)} TikTok Shop video(s)?`;
  }

  function handleBulkCopyOutreach() {
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    if (selectedRows.length === 0) return;
    void copyText(selectedRows.map(buildOutreachForRow).join('\n\n---\n\n'), `已复制 ${selectedRows.length} 条邀约话术。`);
  }

  function handleGenerateMessage() {
    if (!selectedTask) return;
    const creatorCampaign = mergedCampaigns.find((campaign) => campaign.productName === selectedTask.product);
    const generated = generateMessage(selectedTask, channel, campaignToFilmingRequirements(creatorCampaign, activeFilmingRequirements));
    setMessage(generated);
    setSelectedCreatorId(selectedTask.id);
  }

  async function handleCopyGeneratedMessage() {
    if (!message) return;
    await copyText(message.english, '已复制英文话术。');
    setTrackingStatus('已复制英文话术。');
  }

  function handleMarkMessageSent() {
    if (!selectedTask || !message) return;
    const today = todayString();
    setRows((currentRows) => currentRows.map((row) => (row.id === selectedTask.id ? {
      ...row,
      currentStatus: inferStatus(row, requiredVideos) === 'Not Contacted' ? 'Invited' : row.currentStatus,
      lastContactDate: today,
      lastFollowUpCount: row.lastFollowUpCount + 1,
      trackingStatus: 'Followed Up',
      lastMessageScenario: message.scenario,
      lastMessageChannel: channel,
      lastMessageSentAt: today,
      nextFollowUpDate: addDays(2),
      followUpHistory: [...(row.followUpHistory ?? []), { date: today, action: 'Message Sent', channel, scenario: message.scenario, message: message.english }],
    } : row)));
    setTrackingStatus('已标记为发送，并同步更新数据表格。');
    setToast({ tone: 'success', text: '状态已更新，下一次跟进已排程。' });
  }

  function handleMarkCreatorReplied() {
    if (!selectedTask) return;
    const note = window.prompt('记录达人回复内容或下一步重点：') ?? '';
    const today = todayString();
    setRows((currentRows) => currentRows.map((row) => (row.id === selectedTask.id ? {
      ...row,
      currentStatus: 'Replied',
      trackingStatus: 'Replied',
      lastContactDate: today,
      lastCreatorResponse: note,
      followUpHistory: [...(row.followUpHistory ?? []), { date: today, action: 'Creator Replied', note }],
    } : row)));
    setTrackingStatus('已记录达人回复，并同步更新数据表格。');
    setToast({ tone: 'success', text: '已记录达人回复。' });
  }

  function handleSaveFilmingRequirements() {
    const next = {
      productName: filmingProductNameDraft.trim() || defaultCreatorFilmingRequirements.productName,
      requirements: normalizeListText(filmingRequirementsDraft),
      keyContentPoints: normalizeListText(keyContentPointsDraft),
      referenceLinks: normalizeListText(referenceLinksDraft),
    };
    setFilmingRequirements(next);
    setTemplateForm((form) => ({ ...form, productName: next.productName, videos: String(parseRequiredVideos(next)) }));
    saveFilmingRequirements(next);
    setIsEditingFilmingRequirements(false);
    setToast({ tone: 'success', text: '拍摄要求已保存。' });
  }

  function handleEditFilmingRequirements() {
    setFilmingProductNameDraft(filmingRequirements.productName);
    setFilmingRequirementsDraft(listToText(filmingRequirements.requirements));
    setKeyContentPointsDraft(listToText(filmingRequirements.keyContentPoints));
    setReferenceLinksDraft(listToText(filmingRequirements.referenceLinks));
    setIsEditingFilmingRequirements(true);
  }

  function handleRestoreDefaultFilmingRequirements() {
    setFilmingProductNameDraft(defaultCreatorFilmingRequirements.productName);
    setFilmingRequirementsDraft(listToText(defaultCreatorFilmingRequirements.requirements));
    setKeyContentPointsDraft(listToText(defaultCreatorFilmingRequirements.keyContentPoints));
    setReferenceLinksDraft(listToText(defaultCreatorFilmingRequirements.referenceLinks));
    setFilmingRequirements(defaultCreatorFilmingRequirements);
    saveFilmingRequirements(defaultCreatorFilmingRequirements);
    setIsEditingFilmingRequirements(false);
    setToast({ tone: 'success', text: '已恢复默认拍摄要求。' });
  }

  function handleOpenPromptHelper() {
    setPromptHelperForm({ sellingPoints: '', videoCount: String(requiredVideos), durationRequirement: '', targetPetOrScene: '', mustShowShots: '', avoidShots: '', referenceLinks: listToText(filmingRequirements.referenceLinks) });
    setGeneratedChatGptPrompt('');
    setPromptCopyStatus('');
    setIsPromptHelperOpen(true);
  }

  function buildChatGptPrompt() {
    return `请你作为熟悉美国 TikTok Shop 达人合作沟通的内容运营，基于下面的产品信息，生成一版可以直接发给达人的中文「达人拍摄要求」。\n\n【产品信息】\n- 产品名称：${activeFilmingRequirements.productName}\n- 产品卖点：${promptHelperForm.sellingPoints || '请补充'}\n- 目标视频数量：${promptHelperForm.videoCount || requiredVideos}\n- 单条视频时长要求：${promptHelperForm.durationRequirement || '40s+'}\n- 目标宠物 / 使用场景：${promptHelperForm.targetPetOrScene || '真实宠物使用场景'}\n- 必须展示的画面：${promptHelperForm.mustShowShots || '开箱、使用过程、CTA'}\n- 不希望达人这样拍：${promptHelperForm.avoidShots || '避免违规表述'}\n- 对标视频链接（可选）：${promptHelperForm.referenceLinks || '无'}\n\n请按以下结构输出，全部使用简体中文：\n1. 产品名称\n2. 达人拍摄要求\n3. 重点拍摄内容`;
  }

  function renderPageHeader(title: string, description: string, action?: ReactNode) {
    return (
      <div className="page-header">
        <div>
          <p className="eyebrow">TikTok Shop Creator SOP</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
    );
  }


  function renderCampaignSelector() {
    return (
      <section className="campaign-switcher" aria-label="当前产品项目">
        <label>当前产品项目
          <select value={selectedCampaign} onChange={(event) => { setSelectedCampaign(event.target.value); setSelectedIds([]); setMessage(null); }}>
            <option value="ALL">全部产品</option>
            {mergedCampaigns.map((campaign) => <option key={campaign.id} value={campaign.productName}>{campaign.productName}</option>)}
          </select>
        </label>
        <div className="campaign-context">
          <strong>{selectedCampaign === 'ALL' ? '全部产品组合视图' : selectedCampaign}</strong>
          <span>{selectedCampaign === 'ALL' ? '看板、表格、队列合并显示，所有明细展示产品标签。' : '当前页面按该产品项目过滤，并使用该产品的拍摄要求与参考链接。'}</span>
        </div>
      </section>
    );
  }

  function campaignStats(campaign: Campaign) {
    const campaignRows = rows.filter((row) => row.product.trim() === campaign.productName);
    const campaignRequirements = campaignToFilmingRequirements(campaign, filmingRequirements);
    const campaignRequiredVideos = parseRequiredVideos(campaignRequirements);
    const campaignTasks = analyzeCreators(campaignRows, undefined, campaignRequiredVideos);
    const campaignTaskMap = new Map(campaignTasks.map((task) => [task.id, task]));
    return {
      creatorCount: campaignRows.length,
      todayFollowUp: campaignTasks.filter((task) => task.needsFollowUp).length,
      highest: campaignTasks.filter((task) => task.priority === 'Highest').length,
      high: campaignTasks.filter((task) => task.priority === 'High').length,
      inTransit: campaignRows.filter((row) => inferStatus(row, campaignRequiredVideos) === 'Sample Shipped').length,
      deliveredPending: campaignRows.filter((row) => ['Delivered', 'Waiting Video'].includes(inferStatus(row, campaignRequiredVideos))).length,
      remainingVideos: campaignRows.reduce((sum, row) => {
        const progress = normalizeVideoProgress(row.videoProgress, campaignRequiredVideos);
        return sum + Math.max(0, (progress.requiredVideos ?? campaignRequiredVideos) - (progress.postedCount ?? 0));
      }, 0),
      completed: campaignRows.filter((row) => inferStatus(row, campaignRequiredVideos) === 'Completed' || campaignTaskMap.get(row.id)?.trackingStatus === 'Completed').length,
      failed: campaignRows.filter((row) => inferStatus(row, campaignRequiredVideos) === 'Lost' || campaignTaskMap.get(row.id)?.trackingStatus === 'Failed').length,
    };
  }

  function renderCampaignOverview() {
    return (
      <section className="campaign-overview">
        <div className="section-heading"><div><h2>产品项目概览</h2><p className="muted">按产品 Campaign 分离达人、样品、视频履约和失败风险。</p></div></div>
        <div className="campaign-card-grid">
          {mergedCampaigns.map((campaign) => {
            const stats = campaignStats(campaign);
            return (
              <button type="button" key={campaign.id} className="campaign-card" onClick={() => setSelectedCampaign(campaign.productName)}>
                <span className="product-badge">{campaign.productName}</span>
                <strong>{stats.creatorCount} 位达人</strong>
                <div className="campaign-metrics">
                  <span>今日需跟进 <b>{stats.todayFollowUp}</b></span><span>极高 <b>{stats.highest}</b></span><span>高 <b>{stats.high}</b></span><span>样品运输中 <b>{stats.inTransit}</b></span><span>到货待拍 <b>{stats.deliveredPending}</b></span><span>剩余视频 <b>{stats.remainingVideos}</b></span><span>已完成 <b>{stats.completed}</b></span><span>已失败 <b>{stats.failed}</b></span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderImportCard() {
    return (
      <section className="panel compact-panel">
        <div className="section-heading">
          <div>
            <h2>数据导入 / 导出</h2>
            <p className="muted">支持 Excel / CSV 导入导出，数据保存在当前浏览器。</p>
          </div>
          <div className="inline-actions">
            <label className="file-button">
              导入 Excel / CSV
              <input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
            <button type="button" className="secondary" onClick={() => downloadCreatorRowsCsv(rows)} disabled={rows.length === 0}>导出 CSV</button>
            <button type="button" onClick={handleAddCreator}>新增达人</button>
          </div>
        </div>
        {fileName && <p className="muted">已加载：{fileName}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  function renderDashboard() {
    return (
      <>
        {renderPageHeader('数据看板', '每日运营数据概览、优先待办和下一步动作集中在这里。', <button type="button" onClick={() => setActiveModule('creators')}>打开达人数据库</button>)}
        {renderCampaignOverview()}
        <section className="dashboard-grid">
          {dashboardCards.map((card) => (
            <button type="button" key={card.label} className="metric-card" onClick={() => handleDashboardCardClick(card)}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>点击查看 / 筛选</small>
            </button>
          ))}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>今日待办</h2>
              <p className="muted">按优先级展示需要处理的达人，优先解决卡样、卡视频、卡授权。</p>
            </div>
            <button type="button" className="secondary" onClick={() => setActiveModule('followup')}>查看全部跟进</button>
          </div>
          {todayTodo.length === 0 ? (
            <div className="empty-state"><strong>今天暂无高优先级待办。</strong><span>下一步：导入达人表或新增达人，系统会自动生成跟进队列。</span></div>
          ) : (
            <div className="todo-list">
              {todayTodo.map((task) => {
                const status = inferStatus(task, requiredVideos);
                return (
                  <article className="todo-card" key={task.id}>
                    <div>
                      <strong>{displayName(task)}</strong>
                      <span className="product-badge">{task.product || '缺少产品名称'}</span>
                      <span className={statusTone(status)}>{displayStatus(status)}</span>
                    </div>
                    <p><b>触发原因：</b>{task.triggerReason || sampleHint(task, requiredVideos)}</p>
                    <p><b>建议动作：</b>{task.suggestedAction}</p>
                    <div className="inline-actions">
                      <button type="button" className="secondary" onClick={() => void copyText(buildOutreachForRow(task), '已复制待办话术。')}>复制话术</button>
                      <button type="button" className="secondary" onClick={() => applyStatusToRows([task.id], status === 'Not Contacted' ? 'Invited' : 'Waiting Video')}>更新状态</button>
                      <button type="button" onClick={() => { setSelectedCreatorId(task.id); setActiveModule('creators'); }}>查看详情</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </>
    );
  }

  function renderCreatorDatabase() {
    const allSelected = filteredRows.length > 0 && filteredRows.every((entry) => selectedIds.includes(entry.row.id));
    return (
      <>
        {renderPageHeader('达人数据库', '管理达人信息、合作状态、物流状态、视频进度和跟进记录。')}
        {renderImportCard()}
        <section className="panel table-panel">
          <div className="filters-bar">
            <label>搜索<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索达人昵称 / 产品 / 状态" /></label>
            <label>合作状态<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CreatorStatus | 'All')}><option value="All">全部</option>{creatorStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
            <label>达人类型<select value={creatorTypeFilter} onChange={(event) => setCreatorTypeFilter(event.target.value)}><option value="All">全部</option><option>Pet</option><option>UGC</option><option>Grooming</option></select></label>
            <label>粉丝量级<select value={followerFilter} onChange={(event) => setFollowerFilter(event.target.value)}><option value="All">全部</option><option>K</option><option>M</option><option>—</option></select></label>
            <label>平均播放<select value={avgViewsFilter} onChange={(event) => setAvgViewsFilter(event.target.value)}><option value="All">全部</option><option>K</option><option>M</option><option>—</option></select></label>
            <label>GMV 区间<select value={gmvFilter} onChange={(event) => setGmvFilter(event.target.value)}><option value="All">全部</option><option>$</option><option value="low">低</option><option value="mid">中</option><option value="high">高</option><option>—</option></select></label>
          </div>
          <div className="sticky-action-bar">
            <span>已选择 {selectedIds.length} 位达人</span>
            <button type="button" className="secondary" onClick={handleBulkCopyOutreach} disabled={selectedIds.length === 0}>批量复制邀约话术</button>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as CreatorStatus)}>{creatorStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select>
            <button type="button" onClick={handleBulkStatusUpdate} disabled={selectedIds.length === 0}>批量更新状态</button>
          </div>
          {filteredRows.length === 0 ? (
            <div className="empty-state"><strong>没有匹配的达人。</strong><span>下一步：清空筛选、导入 CSV / Excel，或点击 新增达人。</span></div>
          ) : (
            <div className="table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th><input aria-label="全选达人" type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                    <th>达人名称</th>
                    <th>TikTok 账号</th>
                    <th>粉丝量级</th>
                    <th>平均播放</th>
                    <th>GMV 区间</th>
                    <th>达人类型</th>
                    <th>合作状态</th>
                    <th>产品</th>
                    <th>样品物流</th>
                    <th>最近联系日期</th>
                    <th>下次跟进日期</th>
                    <th>跟进记录</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((entry) => (
                    <tr key={entry.row.id}>
                      <td><input aria-label={`选择 ${displayName(entry.row)}` } type="checkbox" checked={selectedIds.includes(entry.row.id)} onChange={() => toggleSelected(entry.row.id)} /></td>
                      <td><input aria-label="达人名称" value={entry.row.username} onChange={(event) => updateRow(entry.row.id, 'username', event.target.value)} /></td>
                      <td><input aria-label="TikTok 账号" value={entry.row.profileLink} onChange={(event) => updateRow(entry.row.id, 'profileLink', event.target.value)} placeholder="@账号或主页链接" /></td>
                      <td>{entry.followers}</td>
                      <td>{entry.avgViews}</td>
                      <td>{entry.gmv}</td>
                      <td>{entry.creatorType}</td>
                      <td><select aria-label="合作状态" value={entry.status} onChange={(event) => applyStatusToRows([entry.row.id], event.target.value as CreatorStatus)}>{creatorStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></td>
                      <td><span className={entry.row.product.trim() ? "product-badge" : "product-warning"}>{entry.row.product.trim() || "缺少产品名称"}</span><input aria-label="产品名称" value={entry.row.product} onChange={(event) => updateRow(entry.row.id, 'product', event.target.value)} /></td>
                      <td><input aria-label="样品物流" value={entry.row.sampleShippingStatus} onChange={(event) => updateRow(entry.row.id, 'sampleShippingStatus', event.target.value)} /></td>
                      <td><input aria-label="最近联系日期" type="date" value={entry.row.lastContactDate} onChange={(event) => updateRow(entry.row.id, 'lastContactDate', event.target.value)} /></td>
                      <td><input aria-label="下次跟进日期" type="date" value={entry.row.nextFollowUpDate ?? ''} onChange={(event) => updateRow(entry.row.id, 'nextFollowUpDate', event.target.value)} /></td>
                      <td><textarea aria-label="跟进记录" value={entry.row.notes} onChange={(event) => updateRow(entry.row.id, 'notes', event.target.value)} rows={2} /></td>
                      <td className="row-actions"><button type="button" className="secondary" onClick={() => void copyText(buildOutreachForRow(entry.row), '已复制邀约话术。')}>复制英文话术</button><button type="button" className="danger secondary" onClick={() => setRows((currentRows) => deleteCreatorRow(currentRows, entry.row.id))}>删除达人</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  function renderTemplates() {
    return (
      <>
        {renderPageHeader('沟通话术模板', '输入变量后，生成适合海外达人的英文沟通话术，并提供中文对照。')}
        <section className="panel template-layout">
          <div className="template-form">
            {(Object.keys(templateForm) as Array<keyof TemplateForm>).map((key) => (
              <label key={key}>{templateFieldLabels[key]}<input value={templateForm[key]} onChange={(event) => setTemplateForm((form) => ({ ...form, [key]: event.target.value }))} /></label>
            ))}
          </div>
          <div className="template-results">
            {templateMessages.map((template) => (
              <article className="template-card" key={template.name}>
                <h3>{template.name}</h3>
                <h4>英文话术</h4>
                <p>{template.english}</p>
                <h4>中文对照</h4>
                <p>{template.chinese}</p>
                <div className="inline-actions"><button type="button" className="secondary" onClick={() => void copyText(template.english, '英文话术已复制。')}>复制英文话术</button><button type="button" className="secondary" disabled={selectedIds.length === 0}>应用到当前达人</button><button type="button" onClick={() => setToast({ tone: 'success', text: '已标记为已发送。' })}>标记为已发送</button></div>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderSamples() {
    return (
      <>
        {renderPageHeader('样品追踪', '围绕物流状态跟踪样品，自动提示卡点动作。')}
        <section className="panel table-panel"><div className="table-wrap"><table className="ops-table"><thead><tr><th>达人名称</th><th>产品名称</th><th>样品状态</th><th>物流商</th><th>物流单号</th><th>寄出日期</th><th>签收日期</th><th>签收后天数</th><th>下一步跟进动作</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td>{displayName(row)}</td><td>{row.product || '—'}</td><td><span className={statusTone(inferStatus(row, requiredVideos))}>{displayStatus(inferStatus(row, requiredVideos))}</span></td><td>{parseNumberFromNotes(row.notes, ['carrier'])}</td><td>{parseNumberFromNotes(row.notes, ['tracking', 'tracking number'])}</td><td>{parseNumberFromNotes(row.notes, ['shipped date'])}</td><td>{row.sampleDeliveredDate || '—'}</td><td>{daysDelivered(row) ?? '—'}</td><td>{sampleHint(row, requiredVideos)}</td></tr>)}</tbody></table></div></section>
      </>
    );
  }

  function renderFollowup() {
    return (
      <>
        {renderPageHeader('达人跟进中心', '按紧急程度和合作阶段筛选达人，生成下一步英文沟通话术。')}
        <section className="panel generator-panel">
          <div className="generator-controls">
            <label>选择达人<select aria-label="选择达人" value={selectedTask?.id ?? ''} onChange={(event) => setSelectedCreatorId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.priority === 'Highest' ? '极高' : task.priority === 'High' ? '高' : task.priority === 'Medium' ? '中' : '低'} · {task.suggestedAction} · {displayName(task)} · {task.product || '缺少产品名称'} · {task.currentStatus || displayStatus(inferStatus(task, requiredVideos))}</option>)}</select></label>
            <label>渠道<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button type="button" onClick={handleGenerateMessage} disabled={!selectedTask}>生成话术</button>
          </div>
          <div className="queue-list">{tasks.map((task) => <button type="button" key={task.id} className="queue-item" onClick={() => setSelectedCreatorId(task.id)}>{task.priority === 'Highest' ? '极高' : task.priority === 'High' ? '高' : task.priority === 'Medium' ? '中' : '低'} · {task.suggestedAction} · {displayName(task)} · {task.product || '缺少产品名称'} · {task.currentStatus || displayStatus(inferStatus(task, requiredVideos))}</button>)}</div>{message && <div className="message-output"><h3>场景 / 沟通动作</h3><p>{message.scenario} · {message.communicationAction}</p><h3>英文话术</h3><pre>{message.english}</pre><h3>中文对照 / 中文解释</h3><p>{message.chineseExplanation}</p><h3>发送后追踪</h3><p>发送后请点击「标记为已发送」，系统会更新最近联系日期、跟进次数和下一次跟进日期。</p><div className="inline-actions"><button type="button" onClick={() => void handleCopyGeneratedMessage()}>复制英文话术</button><button type="button" onClick={handleMarkMessageSent}>标记为已发送</button><button type="button" className="secondary" onClick={handleMarkCreatorReplied}>标记达人已回复</button></div>{trackingStatus && <p className="tracking-status">{trackingStatus}</p>}</div>}
        </section>
      </>
    );
  }

  function renderReview() {
    const checklist = ['是否 40s+', '是否按要求发布 2 条视频', '是否挂 TikTok Shop 商品卡', '是否展示真实宠物使用场景', '是否有清晰开箱/使用过程', '是否有 CTA', '是否存在违规表述', '是否可作为投流素材'];
    return (
      <>
        {renderPageHeader('内容审核', '逐条验收达人视频，输出可执行的验收状态。')}
        <section className="panel review-grid">{visibleRows.map((row) => <article className="review-card" key={row.id}><div><h3>{displayName(row)}</h3><span className={statusTone(inferStatus(row, requiredVideos))}>{displayStatus(inferStatus(row, requiredVideos))}</span></div>{checklist.map((item) => <label key={item} className="check-row"><input type="checkbox" />{item}</label>)}<select defaultValue="Approved"><option value="Approved">审核通过</option><option value="Need Revision">需要修改</option><option value="Product Tag Missing">未挂商品卡</option><option value="Not Usable for Ads">不可投流</option><option value="Ready for Ads">可投流</option></select></article>)}</section>
      </>
    );
  }

  function renderAds() {
    const tags = ['爪部清洁', '遛后护理', '猫咪互动', '狗狗梳毛', '产品演示', '前后对比', 'UGC 口碑', '高 CTR 潜力'];
    return (
      <>
        {renderPageHeader('投流素材库', '沉淀可投流 UGC 视频，管理 Spark Ads 和素材授权。')}
        <section className="panel table-panel"><div className="tag-cloud">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="table-wrap"><table className="ops-table"><thead><tr><th>达人名称</th><th>产品名称</th><th>视频链接</th><th>Hook 角度</th><th>宠物类型</th><th>使用场景</th><th>视频时长</th><th>自然播放量</th><th>互动表现</th><th>转化潜力</th><th>Spark Ads 状态</th><th>素材授权状态</th><th>跟进记录</th></tr></thead><tbody>{visibleRows.filter((row) => ['Ready for Ads', 'Spark Ads Requested', 'Posted'].includes(inferStatus(row, requiredVideos))).map((row) => <tr key={row.id}><td>{displayName(row)}</td><td>{row.product}</td><td>{parseNumberFromNotes(row.notes, ['video url', 'url'])}</td><td>{parseNumberFromNotes(row.notes, ['hook'])}</td><td>{parseNumberFromNotes(row.notes, ['pet type'])}</td><td>{parseNumberFromNotes(row.notes, ['scene'])}</td><td>{parseNumberFromNotes(row.notes, ['length'])}</td><td>{parseNumberFromNotes(row.notes, ['views'])}</td><td>{parseNumberFromNotes(row.notes, ['engagement'])}</td><td>{parseNumberFromNotes(row.notes, ['potential'])}</td><td>{inferStatus(row, requiredVideos) === 'Spark Ads Requested' ? '已申请' : '未申请'}</td><td>{parseNumberFromNotes(row.notes, ['rights'])}</td><td>{row.notes || '—'}</td></tr>)}</tbody></table></div></section>
      </>
    );
  }

  function renderSettings() {
    const targetCampaign = activeCampaign ?? mergedCampaigns[0];
    return (
      <>
        {renderPageHeader('设置', '管理产品项目、拍摄要求、提示词助手和本地数据。')}
        <section className="panel sop-card">
          <div className="section-heading"><div><h2>产品项目设置</h2><p className="muted">每个产品项目独立保存卖点、拍摄要求、参考视频和备注。</p></div><button type="button" onClick={handleEditFilmingRequirements}>编辑拍摄要求</button></div>
          {targetCampaign && <div className="settings-form campaign-settings">
            <label>产品名称<input value={targetCampaign.productName} onChange={(event) => setCampaigns((current) => mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, productName: event.target.value } : campaign))} /></label>
            <label>产品卖点（项目）<textarea value={targetCampaign.sellingPoints} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, sellingPoints: event.target.value } : campaign))} rows={3} /></label>
            <label>拍摄要求<textarea value={listToText(targetCampaign.requirements)} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, requirements: normalizeListText(event.target.value) } : campaign))} rows={5} /></label>
            <label>内容重点<textarea value={listToText(targetCampaign.keyContentPoints)} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, keyContentPoints: normalizeListText(event.target.value) } : campaign))} rows={5} /></label>
            <label>不希望达人这样拍<textarea value={targetCampaign.avoidShots} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, avoidShots: event.target.value } : campaign))} rows={3} /></label>
            <label>视频数量<input value={targetCampaign.videoCount} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, videoCount: event.target.value } : campaign))} /></label>
            <label>视频时长<input value={targetCampaign.videoLength} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, videoLength: event.target.value } : campaign))} /></label>
            <label>挂车 / Tag 要求<input value={targetCampaign.tagRequirement} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, tagRequirement: event.target.value } : campaign))} /></label>
            <label>TikTok Shop 产品链接<input value={targetCampaign.productLink} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, productLink: event.target.value } : campaign))} /></label>
            <label>参考视频链接（项目）<textarea value={listToText(targetCampaign.referenceLinks)} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, referenceLinks: normalizeListText(event.target.value) } : campaign))} rows={3} /></label>
            <label>产品备注<textarea value={targetCampaign.notes} onChange={(event) => setCampaigns(mergedCampaigns.map((campaign) => campaign.id === targetCampaign.id ? { ...campaign, notes: event.target.value } : campaign))} rows={3} /></label>
            <p className="ai-status">产品项目设置会自动保存到 localStorage。</p>{targetCampaign.referenceLinks.length > 0 && <div className="collapsed-copy"><h3>参考视频链接</h3><ul>{targetCampaign.referenceLinks.map((link) => <li key={link}>{link}</li>)}</ul></div>}
          </div>}
          {isEditingFilmingRequirements && <div className="settings-form"><label>默认产品名称<input value={filmingProductNameDraft} onChange={(event) => setFilmingProductNameDraft(event.target.value)} /></label><label>默认拍摄要求（每行一条）<textarea value={filmingRequirementsDraft} onChange={(event) => setFilmingRequirementsDraft(event.target.value)} rows={5} /></label><label>默认内容重点（每行一条）<textarea value={keyContentPointsDraft} onChange={(event) => setKeyContentPointsDraft(event.target.value)} rows={5} /></label><label>对标视频链接（可选，每行一个）<textarea value={referenceLinksDraft} onChange={(event) => setReferenceLinksDraft(event.target.value)} rows={3} /></label><div className="inline-actions"><button type="button" onClick={handleSaveFilmingRequirements}>保存拍摄要求</button><button type="button" className="secondary" onClick={handleRestoreDefaultFilmingRequirements}>恢复默认拍摄要求</button></div></div>}
        </section>
        <section className="panel prompt-helper"><div className="section-heading"><div><h2>用 ChatGPT 辅助生成拍摄要求（可选）</h2><p className="muted">只生成可复制提示词；不会调用 API，也不会自动修改数据。</p></div><button type="button" className="secondary" onClick={() => isPromptHelperOpen ? setIsPromptHelperOpen(false) : handleOpenPromptHelper()}>{isPromptHelperOpen ? '收起辅助生成' : '展开辅助生成'}</button></div>{isPromptHelperOpen && <div className="settings-form"><label>产品卖点<input value={promptHelperForm.sellingPoints} onChange={(event) => setPromptHelperForm((form) => ({ ...form, sellingPoints: event.target.value }))} /></label><label>单条视频时长要求<input value={promptHelperForm.durationRequirement} onChange={(event) => setPromptHelperForm((form) => ({ ...form, durationRequirement: event.target.value }))} /></label><label>对标视频链接（可选，每行一个）<textarea value={promptHelperForm.referenceLinks} onChange={(event) => setPromptHelperForm((form) => ({ ...form, referenceLinks: event.target.value }))} /></label><button type="button" onClick={() => { setGeneratedChatGptPrompt(buildChatGptPrompt()); setPromptCopyStatus(''); }}>生成可复制提示词</button>{generatedChatGptPrompt && <><p className="ai-status">提示词已生成。请复制到 ChatGPT 使用。</p><label>ChatGPT 提示词<textarea value={generatedChatGptPrompt} readOnly rows={8} /></label><button type="button" onClick={() => void copyText(generatedChatGptPrompt, '已复制提示词。').then(() => setPromptCopyStatus('已复制提示词。'))}>复制提示词</button>{promptCopyStatus && <p className="ai-status">{promptCopyStatus}</p>}</>}</div>}</section>
        <section className="panel danger-zone"><div className="section-heading"><div><h2>危险操作</h2><p className="muted">仅清空当前浏览器 localStorage 中的达人数据，不影响产品项目设置。</p></div><button type="button" className="secondary danger" onClick={() => { clearSavedCreatorRows(); setRows([]); setToast({ tone: 'success', text: '已清空本地达人数据。' }); }}>清空当前数据</button></div></section>
      </>
    );
  }

  function renderActiveModule() {
    if (activeModule === 'dashboard') return renderDashboard();
    if (activeModule === 'creators') return renderCreatorDatabase();
    if (activeModule === 'templates') return renderTemplates();
    if (activeModule === 'samples') return renderSamples();
    if (activeModule === 'followup') return renderFollowup();
    if (activeModule === 'review') return renderReview();
    if (activeModule === 'ads') return renderAds();
    return renderSettings();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>TT</span><div><strong>Creator SOP</strong><small>运营工作台</small></div></div>
        <nav aria-label="主导航">
          {navItems.map((item) => <button type="button" key={item.key} className={activeModule === item.key ? 'active' : ''} onClick={() => setActiveModule(item.key)}><i>{navIcons[item.key]}</i><span>{item.label}</span><small>{item.helper}</small></button>)}
        </nav>
      </aside>
      <main className="workspace">{renderCampaignSelector()}{renderActiveModule()}</main>
      {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
    </div>
  );
}

export default App;
