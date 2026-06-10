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
import type { Channel, CreatorRow, GeneratedMessage, Task } from './types';
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

const navItems: Array<{ key: ModuleKey; label: string; helper: string }> = [
  { key: 'dashboard', label: 'Dashboard', helper: 'Daily command center' },
  { key: 'creators', label: 'Creator Database', helper: 'Search, filter, bulk update' },
  { key: 'templates', label: 'Outreach Templates', helper: 'Variable message generator' },
  { key: 'samples', label: 'Sample Tracking', helper: 'Shipment bottlenecks' },
  { key: 'followup', label: 'Follow-up Center', helper: 'Priority action queue' },
  { key: 'review', label: 'Content Review', helper: 'Acceptance checklist' },
  { key: 'ads', label: 'Ads Material Library', helper: 'Spark-ready UGC' },
  { key: 'settings', label: 'Settings', helper: 'Data and SOP defaults' },
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
  return row.username.trim() || 'Unnamed creator';
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

function buildTemplateMessages(form: TemplateForm) {
  const creator = form.creatorName.trim() || '[Creator Name]';
  const product = form.productName.trim() || '[Product Name]';
  const sellingPoint = form.sellingPoint.trim() || '[Product Selling Point]';
  const requirement = form.requirement.trim() || '[Video Requirement]';
  const length = form.length.trim() || '[Video Length]';
  const videos = form.videos.trim() || '[Number of Videos]';
  const tag = form.tagRequirement.trim() || '[Product Tag Requirement]';
  const tracking = form.trackingNumber.trim() || '[Tracking Number]';
  const deadline = form.deadline.trim() || '[Deadline]';

  return [
    ['初次邀约', `Hi ${creator}, we love your pet content and would like to invite you to collaborate on ${product}. Key selling point: ${sellingPoint}. The requirement is ${videos} video(s), ${length}, with ${tag}. Are you open to receiving a sample?`],
    ['达人同意合作', `Amazing, ${creator}! For ${product}, please cover: ${requirement}. Please keep each video ${length}, publish ${videos} video(s), and ${tag}. Deadline target: ${deadline}.`],
    ['样品已寄出', `Your ${product} sample has been shipped. Tracking number: ${tracking}. Once it arrives, please test it with a real pet scene and share your posting plan.`],
    ['样品已签收跟进', `Hi ${creator}, tracking shows the ${product} sample was delivered. Could you confirm you received it and let us know your filming schedule?`],
    ['催发视频', `Hi ${creator}, just checking in on the ${product} video(s). The target is ${videos} video(s) by ${deadline}. Please let us know if you need anything before posting.`],
    ['提醒挂商品卡', `Thanks for posting! One important fix: please attach the TikTok Shop product card for ${product}. ${tag}`],
    ['要求修改视频', `Thanks for the draft/post. Could you revise it to include: ${requirement}. Please also keep it ${length} and avoid unsupported claims.`],
    ['索要 Spark Ads 授权', `This video looks strong for paid boosting. Could you grant Spark Ads authorization / ad code for the ${product} post?`],
    ['合作取消', `Understood. We will cancel this collaboration for ${product}. Please confirm no further posts will be made under this campaign.`],
    ['要求退回样品', `Since the collaboration is cancelled, please return the ${product} sample. We can share the return details and next steps.`],
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
  const [isEditingFilmingRequirements, setIsEditingFilmingRequirements] = useState(false);
  const [filmingProductNameDraft, setFilmingProductNameDraft] = useState(() => defaultCreatorFilmingRequirements.productName);
  const [filmingRequirementsDraft, setFilmingRequirementsDraft] = useState(() => listToText(defaultCreatorFilmingRequirements.requirements));
  const [keyContentPointsDraft, setKeyContentPointsDraft] = useState(() => listToText(defaultCreatorFilmingRequirements.keyContentPoints));
  const [referenceLinksDraft, setReferenceLinksDraft] = useState(() => listToText(defaultCreatorFilmingRequirements.referenceLinks));
  const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
  const [promptHelperForm, setPromptHelperForm] = useState({ sellingPoints: '', videoCount: '', durationRequirement: '', targetPetOrScene: '', mustShowShots: '', avoidShots: '', referenceLinks: '' });
  const [generatedChatGptPrompt, setGeneratedChatGptPrompt] = useState('');
  const [promptCopyStatus, setPromptCopyStatus] = useState('');

  const requiredVideos = useMemo(() => parseRequiredVideos(filmingRequirements), [filmingRequirements]);
  const tasks = useMemo(() => analyzeCreators(rows, undefined, requiredVideos), [rows, requiredVideos]);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const selectedTask = tasks.find((task) => task.id === selectedCreatorId) ?? tasks[0];
  const templateMessages = useMemo(() => buildTemplateMessages(templateForm), [templateForm]);

  useEffect(() => saveCreatorRows(rows), [rows]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const enrichedRows = useMemo(() => rows.map((row) => ({
    row,
    task: tasksById.get(row.id),
    status: inferStatus(row, requiredVideos),
    creatorType: creatorType(row),
    followers: followerCount(row),
    avgViews: avgViews(row),
    gmv: gmvRange(row),
  })), [rows, tasksById, requiredVideos]);

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
    const newRow = createBlankCreatorRow(filmingRequirements.productName, requiredVideos);
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
    setToast({ tone: 'success', text: `已更新 ${ids.length} 位达人状态为 ${status}。` });
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
    return `Hi @${displayName(row)}, we love your TikTok pet content and would like to invite you to collaborate on ${row.product || filmingRequirements.productName}. Are you open to receiving a sample and creating ${requiredVideos} TikTok Shop video(s)?`;
  }

  function handleBulkCopyOutreach() {
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    if (selectedRows.length === 0) return;
    void copyText(selectedRows.map(buildOutreachForRow).join('\n\n---\n\n'), `已复制 ${selectedRows.length} 条邀约话术。`);
  }

  function handleGenerateMessage() {
    if (!selectedTask) return;
    const generated = generateMessage(selectedTask, channel, filmingRequirements);
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
    return `请你作为熟悉美国 TikTok Shop 达人合作沟通的内容运营，基于下面的产品信息，生成一版可以直接发给达人的中文「达人拍摄要求」。\n\n【产品信息】\n- 产品名称：${filmingRequirements.productName}\n- 产品卖点：${promptHelperForm.sellingPoints || '请补充'}\n- 目标视频数量：${promptHelperForm.videoCount || requiredVideos}\n- 单条视频时长要求：${promptHelperForm.durationRequirement || '40s+'}\n- 目标宠物 / 使用场景：${promptHelperForm.targetPetOrScene || '真实宠物使用场景'}\n- 必须展示的画面：${promptHelperForm.mustShowShots || '开箱、使用过程、CTA'}\n- 不希望达人这样拍：${promptHelperForm.avoidShots || '避免违规表述'}\n- 对标视频链接（可选）：${promptHelperForm.referenceLinks || '无'}\n\n请按以下结构输出，全部使用简体中文：\n1. 产品名称\n2. 达人拍摄要求\n3. 重点拍摄内容`;
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

  function renderImportCard() {
    return (
      <section className="panel compact-panel">
        <div className="section-heading">
          <div>
            <h2>Data Import / Export</h2>
            <p className="muted">支持 Excel / CSV 导入导出，数据保存在当前浏览器。</p>
          </div>
          <div className="inline-actions">
            <label className="file-button">
              Import Excel / CSV
              <input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
            <button type="button" className="secondary" onClick={() => downloadCreatorRowsCsv(rows)} disabled={rows.length === 0}>Export CSV</button>
            <button type="button" onClick={handleAddCreator}>Add Creator</button>
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
        {renderPageHeader('Dashboard', '每日运营数据概览、优先待办和下一步动作集中在这里。', <button type="button" onClick={() => setActiveModule('creators')}>Open Creator Database</button>)}
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
                      <span className={statusTone(status)}>{status}</span>
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
        {renderPageHeader('Creator Database', '紧凑表格 + 固定筛选 + 批量操作，替代原来的长页面堆叠。')}
        {renderImportCard()}
        <section className="panel table-panel">
          <div className="filters-bar">
            <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索达人昵称 / 产品 / 状态" /></label>
            <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CreatorStatus | 'All')}><option>All</option>{creatorStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label>Creator Type<select value={creatorTypeFilter} onChange={(event) => setCreatorTypeFilter(event.target.value)}><option>All</option><option>Pet</option><option>UGC</option><option>Grooming</option></select></label>
            <label>Follower Count<select value={followerFilter} onChange={(event) => setFollowerFilter(event.target.value)}><option>All</option><option>K</option><option>M</option><option>—</option></select></label>
            <label>Avg Views<select value={avgViewsFilter} onChange={(event) => setAvgViewsFilter(event.target.value)}><option>All</option><option>K</option><option>M</option><option>—</option></select></label>
            <label>GMV Range<select value={gmvFilter} onChange={(event) => setGmvFilter(event.target.value)}><option>All</option><option>$</option><option>low</option><option>mid</option><option>high</option><option>—</option></select></label>
          </div>
          <div className="sticky-action-bar">
            <span>{selectedIds.length} selected</span>
            <button type="button" className="secondary" onClick={handleBulkCopyOutreach} disabled={selectedIds.length === 0}>批量复制邀约话术</button>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as CreatorStatus)}>{creatorStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            <button type="button" onClick={handleBulkStatusUpdate} disabled={selectedIds.length === 0}>批量更新状态</button>
          </div>
          {filteredRows.length === 0 ? (
            <div className="empty-state"><strong>没有匹配的达人。</strong><span>下一步：清空筛选、导入 CSV / Excel，或点击 Add Creator。</span></div>
          ) : (
            <div className="table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th><input aria-label="Select all creators" type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                    <th>Creator Name</th>
                    <th>TikTok Handle</th>
                    <th>Follower Count</th>
                    <th>Avg Views</th>
                    <th>GMV Range</th>
                    <th>Niche</th>
                    <th>Status</th>
                    <th>Product</th>
                    <th>Sample Tracking</th>
                    <th>Last Contact Date</th>
                    <th>Next Follow-up Date</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((entry) => (
                    <tr key={entry.row.id}>
                      <td><input aria-label={`Select ${displayName(entry.row)}`} type="checkbox" checked={selectedIds.includes(entry.row.id)} onChange={() => toggleSelected(entry.row.id)} /></td>
                      <td><input aria-label="Creator Name" value={entry.row.username} onChange={(event) => updateRow(entry.row.id, 'username', event.target.value)} /></td>
                      <td><input aria-label="TikTok Handle" value={entry.row.profileLink} onChange={(event) => updateRow(entry.row.id, 'profileLink', event.target.value)} placeholder="@handle or URL" /></td>
                      <td>{entry.followers}</td>
                      <td>{entry.avgViews}</td>
                      <td>{entry.gmv}</td>
                      <td>{entry.creatorType}</td>
                      <td><select aria-label="Status" value={entry.status} onChange={(event) => applyStatusToRows([entry.row.id], event.target.value as CreatorStatus)}>{creatorStatuses.map((status) => <option key={status}>{status}</option>)}</select></td>
                      <td><input aria-label="Product" value={entry.row.product} onChange={(event) => updateRow(entry.row.id, 'product', event.target.value)} /></td>
                      <td><input aria-label="Sample Tracking" value={entry.row.sampleShippingStatus} onChange={(event) => updateRow(entry.row.id, 'sampleShippingStatus', event.target.value)} /></td>
                      <td><input aria-label="Last Contact Date" type="date" value={entry.row.lastContactDate} onChange={(event) => updateRow(entry.row.id, 'lastContactDate', event.target.value)} /></td>
                      <td><input aria-label="Next Follow-up Date" type="date" value={entry.row.nextFollowUpDate ?? ''} onChange={(event) => updateRow(entry.row.id, 'nextFollowUpDate', event.target.value)} /></td>
                      <td><textarea aria-label="Notes" value={entry.row.notes} onChange={(event) => updateRow(entry.row.id, 'notes', event.target.value)} rows={2} /></td>
                      <td className="row-actions"><button type="button" className="secondary" onClick={() => void copyText(buildOutreachForRow(entry.row), '已复制邀约话术。')}>Copy</button><button type="button" className="danger secondary" onClick={() => setRows((currentRows) => deleteCreatorRow(currentRows, entry.row.id))}>Delete</button></td>
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
        {renderPageHeader('Outreach Templates', '变量化模板生成器：输入一次变量，生成全流程话术。')}
        <section className="panel template-layout">
          <div className="template-form">
            {(Object.keys(templateForm) as Array<keyof TemplateForm>).map((key) => (
              <label key={key}>{key.replace(/([A-Z])/g, ' $1')}<input value={templateForm[key]} onChange={(event) => setTemplateForm((form) => ({ ...form, [key]: event.target.value }))} /></label>
            ))}
          </div>
          <div className="template-results">
            {templateMessages.map(([label, text]) => (
              <article className="template-card" key={label}>
                <h3>{label}</h3>
                <p>{text}</p>
                <div className="inline-actions"><button type="button" className="secondary" onClick={() => void copyText(text, '话术已复制。')}>Copy</button><button type="button" className="secondary" disabled={selectedIds.length === 0}>Apply to selected creator</button><button type="button" onClick={() => setToast({ tone: 'success', text: '已标记为 sent。' })}>Mark as sent</button></div>
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
        {renderPageHeader('Sample Tracking', '围绕物流状态跟踪样品，自动提示卡点动作。')}
        <section className="panel table-panel"><div className="table-wrap"><table className="ops-table"><thead><tr><th>Creator</th><th>Product</th><th>Sample Status</th><th>Carrier</th><th>Tracking Number</th><th>Shipped Date</th><th>Delivered Date</th><th>Days Since Delivered</th><th>Next Follow-up Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{displayName(row)}</td><td>{row.product || '—'}</td><td><span className={statusTone(inferStatus(row, requiredVideos))}>{inferStatus(row, requiredVideos)}</span></td><td>{parseNumberFromNotes(row.notes, ['carrier'])}</td><td>{parseNumberFromNotes(row.notes, ['tracking', 'tracking number'])}</td><td>{parseNumberFromNotes(row.notes, ['shipped date'])}</td><td>{row.sampleDeliveredDate || '—'}</td><td>{daysDelivered(row) ?? '—'}</td><td>{sampleHint(row, requiredVideos)}</td></tr>)}</tbody></table></div></section>
      </>
    );
  }

  function renderFollowup() {
    return (
      <>
        {renderPageHeader('Follow-up Center', '集中处理达人回复、逾期发布、样品签收后无反馈等动作。')}
        <section className="panel generator-panel">
          <div className="generator-controls">
            <label>选择达人<select aria-label="选择达人" value={selectedTask?.id ?? ''} onChange={(event) => setSelectedCreatorId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{displayName(task)} · {inferStatus(task, requiredVideos)} · {task.suggestedAction}</option>)}</select></label>
            <label>渠道<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button type="button" onClick={handleGenerateMessage} disabled={!selectedTask}>生成话术</button>
          </div>
          {message && <div className="message-output"><h3>英文话术</h3><pre>{message.english}</pre><h3>中文解释</h3><p>{message.chineseExplanation}</p><div className="inline-actions"><button type="button" onClick={() => void handleCopyGeneratedMessage()}>复制话术</button><button type="button" onClick={handleMarkMessageSent}>标记为已发送</button><button type="button" className="secondary" onClick={handleMarkCreatorReplied}>标记达人已回复</button></div>{trackingStatus && <p className="tracking-status">{trackingStatus}</p>}</div>}
        </section>
      </>
    );
  }

  function renderReview() {
    const checklist = ['是否 40s+', '是否按要求发布 2 条视频', '是否挂 TikTok Shop 商品卡', '是否展示真实宠物使用场景', '是否有清晰开箱/使用过程', '是否有 CTA', '是否存在违规表述', '是否可作为投流素材'];
    return (
      <>
        {renderPageHeader('Content Review', '逐条验收达人视频，输出可执行的验收状态。')}
        <section className="panel review-grid">{rows.map((row) => <article className="review-card" key={row.id}><div><h3>{displayName(row)}</h3><span className={statusTone(inferStatus(row, requiredVideos))}>{inferStatus(row, requiredVideos)}</span></div>{checklist.map((item) => <label key={item} className="check-row"><input type="checkbox" />{item}</label>)}<select defaultValue="Approved"><option>Approved</option><option>Need Revision</option><option>Product Tag Missing</option><option>Not Usable for Ads</option><option>Ready for Ads</option></select></article>)}</section>
      </>
    );
  }

  function renderAds() {
    const tags = ['Paw Cleaning', 'After Walk', 'Cat Playing', 'Dog Grooming', 'Product Demo', 'Before After', 'UGC Review', 'High CTR Potential'];
    return (
      <>
        {renderPageHeader('Ads Material Library', '沉淀可投流视频，管理 Spark Ads 和素材授权。')}
        <section className="panel table-panel"><div className="tag-cloud">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="table-wrap"><table className="ops-table"><thead><tr><th>Creator</th><th>Product</th><th>Video URL</th><th>Hook Angle</th><th>Pet Type</th><th>Scene</th><th>Video Length</th><th>Organic Views</th><th>Engagement</th><th>Conversion Potential</th><th>Spark Ads Status</th><th>Usage Rights Status</th><th>Notes</th></tr></thead><tbody>{rows.filter((row) => ['Ready for Ads', 'Spark Ads Requested', 'Posted'].includes(inferStatus(row, requiredVideos))).map((row) => <tr key={row.id}><td>{displayName(row)}</td><td>{row.product}</td><td>{parseNumberFromNotes(row.notes, ['video url', 'url'])}</td><td>{parseNumberFromNotes(row.notes, ['hook'])}</td><td>{parseNumberFromNotes(row.notes, ['pet type'])}</td><td>{parseNumberFromNotes(row.notes, ['scene'])}</td><td>{parseNumberFromNotes(row.notes, ['length'])}</td><td>{parseNumberFromNotes(row.notes, ['views'])}</td><td>{parseNumberFromNotes(row.notes, ['engagement'])}</td><td>{parseNumberFromNotes(row.notes, ['potential'])}</td><td>{inferStatus(row, requiredVideos) === 'Spark Ads Requested' ? 'Requested' : 'Not requested'}</td><td>{parseNumberFromNotes(row.notes, ['rights'])}</td><td>{row.notes || '—'}</td></tr>)}</tbody></table></div></section>
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        {renderPageHeader('Settings', '管理 SOP 默认拍摄要求、说明折叠、数据清理。')}
        <section className="panel">
          <div className="section-heading"><div><h2>拍摄要求</h2><p className="muted">默认折叠说明，减少页面文字密度。</p></div><button type="button" onClick={handleEditFilmingRequirements}>编辑拍摄要求</button></div>
          {isEditingFilmingRequirements ? <div className="settings-form"><label>产品名称<input value={filmingProductNameDraft} onChange={(event) => setFilmingProductNameDraft(event.target.value)} /></label><label>拍摄要求（每行一条）<textarea value={filmingRequirementsDraft} onChange={(event) => setFilmingRequirementsDraft(event.target.value)} rows={5} /></label><label>内容重点（每行一条）<textarea value={keyContentPointsDraft} onChange={(event) => setKeyContentPointsDraft(event.target.value)} rows={5} /></label><label>对标视频链接（可选，每行一个）<textarea value={referenceLinksDraft} onChange={(event) => setReferenceLinksDraft(event.target.value)} rows={3} /></label><div className="inline-actions"><button type="button" onClick={handleSaveFilmingRequirements}>保存拍摄要求</button><button type="button" className="secondary" onClick={handleRestoreDefaultFilmingRequirements}>恢复默认拍摄要求</button></div></div> : <details className="collapsed-copy"><summary>{filmingRequirements.productName}</summary><ul>{filmingRequirements.requirements.map((item) => <li key={item}>{item}</li>)}</ul><h3>重点拍摄内容</h3><ul>{filmingRequirements.keyContentPoints.map((item) => <li key={item}>{item}</li>)}</ul>{(filmingRequirements.referenceLinks?.length ?? 0) > 0 && <><h3>参考视频链接</h3><ul>{filmingRequirements.referenceLinks?.map((item) => <li key={item}>{item}</li>)}</ul></>}</details>}
        </section>
        <section className="panel"><div className="section-heading"><div><h2>用 ChatGPT 辅助生成拍摄要求（可选）</h2><p className="muted">这个功能只会生成可复制的提示词，不会自动修改或保存拍摄要求。复制到 ChatGPT 生成结果后，再粘贴到上方「达人拍摄要求」里保存。</p></div><button type="button" className="secondary" onClick={() => isPromptHelperOpen ? setIsPromptHelperOpen(false) : handleOpenPromptHelper()}>{isPromptHelperOpen ? '收起辅助生成' : '展开辅助生成'}</button></div>{isPromptHelperOpen && <div className="settings-form"><label>产品卖点<input value={promptHelperForm.sellingPoints} onChange={(event) => setPromptHelperForm((form) => ({ ...form, sellingPoints: event.target.value }))} /></label><label>单条视频时长要求<input value={promptHelperForm.durationRequirement} onChange={(event) => setPromptHelperForm((form) => ({ ...form, durationRequirement: event.target.value }))} /></label><label>对标视频链接（可选，每行一个）<textarea value={promptHelperForm.referenceLinks} onChange={(event) => setPromptHelperForm((form) => ({ ...form, referenceLinks: event.target.value }))} /></label><button type="button" onClick={() => { setGeneratedChatGptPrompt(buildChatGptPrompt()); setPromptCopyStatus(''); }}>生成可复制提示词</button>{generatedChatGptPrompt && <><p className="ai-status">提示词已生成。请复制到 ChatGPT 使用。</p><p className="prompt-next-step">下一步：复制提示词到 ChatGPT，生成结果后，把适合的内容粘贴到上方「拍摄要求」和「内容重点」里，再点击保存。</p><label>ChatGPT 提示词<textarea value={generatedChatGptPrompt} readOnly rows={8} /></label><button type="button" onClick={() => void copyText(generatedChatGptPrompt, '已复制提示词。').then(() => setPromptCopyStatus('已复制提示词。'))}>复制提示词</button>{promptCopyStatus && <p className="ai-status">{promptCopyStatus}</p>}</>}</div>}</section>
        <section className="panel"><div className="inline-actions"><button type="button" className="secondary danger" onClick={() => { clearSavedCreatorRows(); setRows([]); setToast({ tone: 'success', text: '已清空本地达人数据。' }); }}>清空当前数据</button></div></section>
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
        <div className="brand"><span>TT</span><div><strong>Creator SOP</strong><small>Operations Workbench</small></div></div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => <button type="button" key={item.key} className={activeModule === item.key ? 'active' : ''} onClick={() => setActiveModule(item.key)}><span>{item.label}</span><small>{item.helper}</small></button>)}
        </nav>
      </aside>
      <main className="workspace">{renderActiveModule()}</main>
      {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
    </div>
  );
}

export default App;
