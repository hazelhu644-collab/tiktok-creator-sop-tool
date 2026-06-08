import { useEffect, useMemo, useState } from 'react';
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
import { analyzeCreators, buildSummary, buildVideoProgressHint, daysSince, normalizeVideoProgress, parseRequiredVideos } from './sopRules';
import { CHANNELS, classifyCreatorFollowUp, defaultCreatorFilmingRequirements, generateMessage, type CreatorFilmingRequirements } from './messageGenerator';
import type { Channel, CreatorRow, FollowUpHistoryEntry, GeneratedMessage, Priority, Task, UrgencyLevel } from './types';
import './styles.css';

const priorityClass: Record<string, string> = {
  Highest: 'priority highest',
  High: 'priority high',
  Medium: 'priority medium',
  Low: 'priority low',
  None: 'priority none',
};

const priorityLabel: Record<Priority, string> = {
  Highest: '最高',
  High: '高',
  Medium: '中',
  Low: '低',
  None: '无',
};

const FILMING_REQUIREMENTS_STORAGE_KEY = 'tiktokCreatorSop.filmingRequirements';

type ChatGptPromptHelperForm = {
  sellingPoints: string;
  videoCount: string;
  durationRequirement: string;
  targetPetOrScene: string;
  mustShowShots: string;
  avoidShots: string;
  referenceLinks: string;
};

const emptyChatGptPromptHelperForm: ChatGptPromptHelperForm = {
  sellingPoints: '',
  videoCount: '',
  durationRequirement: '',
  targetPetOrScene: '',
  mustShowShots: '',
  avoidShots: '',
  referenceLinks: '',
};

const scenarioLabel: Record<string, string> = {
  'First Outreach': '首次建联',
  'No Reply Follow-up': '建联后未回复跟进',
  'Sample Request Reminder': '提醒达人申请样品',
  'Sample Request Confirmation': '样品申请后确认',
  'Sample In Transit Reminder': '样品运输中提醒',
  'Sample Delivered Follow-up': '样品到货后催拍',
  'Partial Video Completion Follow-up': '已发布部分视频，跟进剩余视频',
  'Needs Revision Reminder': '视频修改提醒',
  'Completed Thank You': '合作完成感谢 / 后续合作',
  'Failed Archive Confirmation': '合作失败归档',
  'Final Follow-up Before Failed Candidate': '合作失败风险前的最后跟进',
  'Second Video Reminder': '第二条视频提醒',
  'Second Follow-up': '第二次跟进',
  'Light Follow-up': '轻量跟进',
};

function normalizeReferenceLinksText(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeListText(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRequirementsText(items: string[]): string {
  return items.join('\n');
}

function loadFilmingRequirements(): CreatorFilmingRequirements {
  if (typeof window === 'undefined') return defaultCreatorFilmingRequirements;

  try {
    const savedRequirements = window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY);
    if (!savedRequirements) return defaultCreatorFilmingRequirements;

    const parsedRequirements = JSON.parse(savedRequirements) as Partial<CreatorFilmingRequirements>;
    return {
      productName: typeof parsedRequirements.productName === 'string'
        ? parsedRequirements.productName
        : defaultCreatorFilmingRequirements.productName,
      requirements: Array.isArray(parsedRequirements.requirements)
        ? parsedRequirements.requirements.filter((item): item is string => typeof item === 'string')
        : defaultCreatorFilmingRequirements.requirements,
      keyContentPoints: Array.isArray(parsedRequirements.keyContentPoints)
        ? parsedRequirements.keyContentPoints.filter((item): item is string => typeof item === 'string')
        : defaultCreatorFilmingRequirements.keyContentPoints,
      referenceLinks: Array.isArray(parsedRequirements.referenceLinks)
        ? parsedRequirements.referenceLinks.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
        : defaultCreatorFilmingRequirements.referenceLinks,
    };
  } catch {
    return defaultCreatorFilmingRequirements;
  }
}

function saveFilmingRequirements(filmingRequirements: CreatorFilmingRequirements) {
  window.localStorage.setItem(FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify(filmingRequirements));
}

function displayCreatorName(username: string): string {
  return username.trim() || '未命名达人';
}

const creatorQuickFilters = [
  { key: 'all', label: '全部' },
  { key: '极高', label: '极高' },
  { key: '高', label: '高' },
  { key: '中', label: '中' },
  { key: '低', label: '低' },
  { key: '归档', label: '归档' },
] as const;

type CreatorQuickFilterKey = typeof creatorQuickFilters[number]['key'];

const urgencySortRank: Record<UrgencyLevel, number> = {
  极高: 1,
  高: 2,
  中: 3,
  低: 4,
  归档: 5,
};

function statusText(task: Task): string {
  return task.currentStatus.trim() || '未填写状态';
}

function normalizedTaskSearchText(task: Task, requiredVideos: number): string {
  const classification = classifyCreatorFollowUp(task, requiredVideos);
  return [
    task.username,
    task.product,
    task.currentStatus,
    task.trackingStatus,
    task.contactMethod,
    priorityLabel[task.priority],
    task.priority,
    task.sampleShippingStatus,
    classification.urgencyLevel,
    classification.communicationAction,
  ].join(' ').toLowerCase();
}

function compareDateAscending(aDate: string, bDate: string): number {
  const a = aDate.trim();
  const b = bDate.trim();
  if (a && b && a !== b) return a.localeCompare(b);
  if (a && !b) return -1;
  if (!a && b) return 1;
  return 0;
}

function compareCreatorQueueOrder(a: Task, b: Task, requiredVideos: number): number {
  const aClassification = classifyCreatorFollowUp(a, requiredVideos);
  const bClassification = classifyCreatorFollowUp(b, requiredVideos);
  const urgencyDifference = urgencySortRank[aClassification.urgencyLevel] - urgencySortRank[bClassification.urgencyLevel];
  if (urgencyDifference !== 0) return urgencyDifference;

  const lastContactDifference = compareDateAscending(a.lastContactDate, b.lastContactDate);
  if (lastContactDifference !== 0) return lastContactDifference;

  const sampleDeliveredDifference = compareDateAscending(a.sampleDeliveredDate, b.sampleDeliveredDate);
  if (sampleDeliveredDifference !== 0) return sampleDeliveredDifference;

  return a.username.localeCompare(b.username);
}

function matchesQuickFilter(task: Task, quickFilter: CreatorQuickFilterKey, requiredVideos: number): boolean {
  if (quickFilter === 'all') return true;
  return classifyCreatorFollowUp(task, requiredVideos).urgencyLevel === quickFilter;
}

function creatorGeneratorEmptyState(): string {
  return '没有匹配的达人，请调整搜索词或切换筛选。';
}

function creatorOptionLabel(task: Task, requiredVideos: number): string {
  const classification = classifyCreatorFollowUp(task, requiredVideos);
  const productText = task.product.trim() ? ` · ${task.product.trim()}` : '';
  return `${classification.urgencyLevel} · ${classification.communicationAction} · ${displayCreatorName(task.username)} · ${statusText(task)}${productText}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): string {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDate(nextDate);
}

function followUpDelayDays(scenario: string): number {
  if (scenario === 'Final Follow-up Before Failed Candidate' || scenario === 'Second Follow-up') return 1;
  return 2;
}

function suggestedNextAction(scenario: string): string {
  if (scenario === 'Final Follow-up Before Failed Candidate') return '如果达人仍未回复，可再次确认是否继续合作，并准备标记合作失败。';
  if (scenario === 'Partial Video Completion Follow-up') return '如果达人仍未更新剩余视频，可再次确认发布时间或剩余内容计划。';
  if (scenario === 'Second Follow-up') return '如果达人仍未回复，可再次确认是否继续合作。';
  return '如果达人仍未回复，可再次确认是否继续合作。';
}

function messagePreview(messageText: string): string {
  const normalized = messageText.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 90)}…`;
}

function completedVideoProgress(currentProgress: string, requiredVideos: number): string {
  const progress = normalizeVideoProgress(currentProgress, requiredVideos);
  if (typeof progress.postedCount === 'number' && progress.postedCount >= requiredVideos) return progress.normalized;
  return `${requiredVideos} of ${requiredVideos}`;
}

function appendUniqueNote(existingNotes: string, note: string): string {
  const trimmedNote = note.trim();
  if (!trimmedNote) return existingNotes;
  if (existingNotes.includes(trimmedNote)) return existingNotes;
  return [existingNotes.trim(), trimmedNote].filter(Boolean).join('\n');
}

function trackingRowClass(row: CreatorRow): string | undefined {
  if (row.trackingStatus === 'Completed') return 'tracking-row-completed';
  if (row.trackingStatus === 'Failed') return 'tracking-row-failed';
  return undefined;
}

function App() {
  const [rows, setRows] = useState<CreatorRow[]>(() => loadCreatorRows());
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');
  const [creatorQuickFilter, setCreatorQuickFilter] = useState<CreatorQuickFilterKey>('all');
  const [channel, setChannel] = useState<Channel>('TikTok DM');
  const [message, setMessage] = useState<GeneratedMessage | null>(null);
  const [filmingRequirements, setFilmingRequirements] = useState<CreatorFilmingRequirements>(() => loadFilmingRequirements());
  const [isEditingFilmingRequirements, setIsEditingFilmingRequirements] = useState(false);
  const [filmingProductNameDraft, setFilmingProductNameDraft] = useState(() => defaultCreatorFilmingRequirements.productName);
  const [filmingRequirementsDraft, setFilmingRequirementsDraft] = useState(() => toRequirementsText(defaultCreatorFilmingRequirements.requirements));
  const [keyContentPointsDraft, setKeyContentPointsDraft] = useState(() => toRequirementsText(defaultCreatorFilmingRequirements.keyContentPoints));
  const [referenceLinksDraft, setReferenceLinksDraft] = useState(() => toRequirementsText(defaultCreatorFilmingRequirements.referenceLinks ?? []));
  const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
  const [promptHelperForm, setPromptHelperForm] = useState<ChatGptPromptHelperForm>(() => emptyChatGptPromptHelperForm);
  const [generatedChatGptPrompt, setGeneratedChatGptPrompt] = useState('');
  const [promptCopyStatus, setPromptCopyStatus] = useState('');
  const [trackingStatus, setTrackingStatus] = useState('');
  const [generatedMessageCreatorId, setGeneratedMessageCreatorId] = useState('');
  const [nextFollowUpRecommendation, setNextFollowUpRecommendation] = useState<{ date: string; action: string } | null>(null);

  const requiredVideos = useMemo(() => parseRequiredVideos(filmingRequirements), [filmingRequirements]);
  const videoProgressHint = useMemo(() => buildVideoProgressHint(requiredVideos), [requiredVideos]);
  const tasks = useMemo(() => analyzeCreators(rows, undefined, requiredVideos), [rows, requiredVideos]);
  const followUpTasks = tasks.filter((task) => task.needsFollowUp);
  const generatorTasks = useMemo(() => {
    const normalizedSearch = creatorSearchTerm.trim().toLowerCase();
    return [...tasks]
      .sort((a, b) => compareCreatorQueueOrder(a, b, requiredVideos))
      .filter((task) => matchesQuickFilter(task, creatorQuickFilter, requiredVideos))
      .filter((task) => !normalizedSearch || normalizedTaskSearchText(task, requiredVideos).includes(normalizedSearch));
  }, [tasks, creatorSearchTerm, creatorQuickFilter, requiredVideos]);
  const summary = useMemo(() => buildSummary(tasks), [tasks]);
  const highestTasks = tasks.filter((task) => task.priority === 'Highest');
  const failedCandidates = tasks.filter((task) => task.failedWarnings.length > 0);
  const selectedTask = generatorTasks.find((task) => task.id === selectedCreatorId) ?? generatorTasks[0];
  const generatedMessageCreator = rows.find((row) => row.id === generatedMessageCreatorId);
  const selectedHistory = generatedMessageCreator?.followUpHistory ?? [];

  useEffect(() => {
    saveCreatorRows(rows);
  }, [rows]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setError('');
      setMessage(null);
      setGeneratedMessageCreatorId('');
      setNextFollowUpRecommendation(null);
      setTrackingStatus('');
      const parsedRows = await parseCreatorFile(file, requiredVideos);
      setRows(parsedRows);
      setFileName(file.name);
      setSelectedCreatorId('');
      if (parsedRows.length === 0) {
        setError('没有找到达人数据。请检查表头和表格内容。');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法解析该文件。');
      setFileName('');
    }
  }

  function handleGenerateMessage() {
    if (!selectedTask) return;
    setMessage(generateMessage(selectedTask, channel, filmingRequirements));
    setGeneratedMessageCreatorId(selectedTask.id);
    setNextFollowUpRecommendation(null);
    setTrackingStatus('');
  }

  async function handleCopyGeneratedMessage() {
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message.english);
      setTrackingStatus('已复制英文话术。');
    } catch {
      setTrackingStatus('复制失败，请手动选中英文话术复制。');
    }
  }

  function updateGeneratedCreator(updater: (row: CreatorRow, today: string) => CreatorRow, confirmation: string) {
    if (!generatedMessageCreatorId) return;
    const today = formatDate(new Date());

    setRows((currentRows) => {
      const updatedRows = currentRows.map((row) => (
        row.id === generatedMessageCreatorId ? updater(row, today) : row
      ));
      saveCreatorRows(updatedRows);
      return updatedRows;
    });
    setTrackingStatus(confirmation);
  }

  function handleMarkMessageSent() {
    if (!message) return;
    const scenario = message.scenario;
    const nextDate = addDays(new Date(), followUpDelayDays(scenario));
    const nextAction = suggestedNextAction(scenario);

    updateGeneratedCreator((row, today) => {
      const entry: FollowUpHistoryEntry = {
        date: today,
        channel,
        scenario: scenarioLabel[scenario] ?? scenario,
        message: message.english,
        action: 'Message Sent',
      };

      return {
        ...row,
        lastContactDate: today,
        lastFollowUpCount: row.lastFollowUpCount + 1,
        trackingStatus: 'Followed Up',
        lastMessageScenario: scenarioLabel[scenario] ?? scenario,
        lastMessageChannel: channel,
        lastMessageSentAt: today,
        nextFollowUpDate: nextDate,
        followUpHistory: [...(row.followUpHistory ?? []), entry],
      };
    }, '已标记为发送，并同步更新数据表格。');
    setNextFollowUpRecommendation({ date: nextDate, action: nextAction });
  }

  function handleMarkCreatorReplied() {
    const note = window.prompt('记录达人回复内容或下一步重点：');
    if (note === null) return;
    const trimmedNote = note.trim();

    updateGeneratedCreator((row, today) => ({
      ...row,
      lastContactDate: today,
      lastCreatorResponse: trimmedNote,
      trackingStatus: 'Replied',
      followUpHistory: [
        ...(row.followUpHistory ?? []),
        { date: today, action: 'Creator Replied', note: trimmedNote },
      ],
    }), '已记录达人回复，并同步更新数据表格。');
  }

  function handleMarkCompleted() {
    const confirmed = window.confirm('确定要标记这个达人合作完成吗？');
    if (!confirmed) return;

    updateGeneratedCreator((row, today) => ({
      ...row,
      currentStatus: 'Completed',
      trackingStatus: 'Completed',
      videoProgress: completedVideoProgress(row.videoProgress, requiredVideos),
      videoProgressWarning: undefined,
      lastContactDate: today,
      followUpHistory: [
        ...(row.followUpHistory ?? []),
        { date: today, action: 'Completed' },
      ],
    }), '已标记合作完成，并同步更新数据表格。');
  }

  function handleMarkFailed() {
    const confirmed = window.confirm('确定要标记这个达人合作失败吗？');
    if (!confirmed) return;
    const note = window.prompt('记录失败原因或备注（可选）：');
    if (note === null) return;
    const trimmedNote = note.trim();

    updateGeneratedCreator((row, today) => ({
      ...row,
      currentStatus: 'Failed',
      trackingStatus: 'Failed',
      lastContactDate: today,
      lastCreatorResponse: trimmedNote || row.lastCreatorResponse,
      notes: appendUniqueNote(row.notes, trimmedNote),
      followUpHistory: [
        ...(row.followUpHistory ?? []),
        { date: today, action: 'Failed', note: trimmedNote },
      ],
    }), '已标记合作失败，并同步更新数据表格。');
  }

  function handleEditFilmingRequirements() {
    setFilmingProductNameDraft(filmingRequirements.productName);
    setFilmingRequirementsDraft(toRequirementsText(filmingRequirements.requirements));
    setKeyContentPointsDraft(toRequirementsText(filmingRequirements.keyContentPoints));
    setReferenceLinksDraft(toRequirementsText(filmingRequirements.referenceLinks ?? []));
    setIsEditingFilmingRequirements(true);
  }

  function handleSaveFilmingRequirements() {
    const nextFilmingRequirements = {
      productName: filmingProductNameDraft.trim() || defaultCreatorFilmingRequirements.productName,
      requirements: normalizeListText(filmingRequirementsDraft),
      keyContentPoints: normalizeListText(keyContentPointsDraft),
      referenceLinks: normalizeReferenceLinksText(referenceLinksDraft),
    };

    setFilmingRequirements(nextFilmingRequirements);
    saveFilmingRequirements(nextFilmingRequirements);
    setIsEditingFilmingRequirements(false);
    setMessage(null);
  }

  function handleRestoreDefaultFilmingRequirements() {
    setFilmingProductNameDraft(defaultCreatorFilmingRequirements.productName);
    setFilmingRequirementsDraft(toRequirementsText(defaultCreatorFilmingRequirements.requirements));
    setKeyContentPointsDraft(toRequirementsText(defaultCreatorFilmingRequirements.keyContentPoints));
    setReferenceLinksDraft(toRequirementsText(defaultCreatorFilmingRequirements.referenceLinks ?? []));
    setFilmingRequirements(defaultCreatorFilmingRequirements);
    saveFilmingRequirements(defaultCreatorFilmingRequirements);
    setIsEditingFilmingRequirements(false);
    setMessage(null);
  }

  function handleOpenPromptHelper() {
    setPromptHelperForm({
      ...emptyChatGptPromptHelperForm,
      videoCount: String(requiredVideos),
      referenceLinks: toRequirementsText(filmingRequirements.referenceLinks ?? []),
    });
    setGeneratedChatGptPrompt('');
    setPromptCopyStatus('');
    setIsPromptHelperOpen(true);
  }

  function handleClosePromptHelper() {
    setIsPromptHelperOpen(false);
    setGeneratedChatGptPrompt('');
    setPromptCopyStatus('');
  }

  function updatePromptHelperField(field: keyof ChatGptPromptHelperForm, value: string) {
    setPromptHelperForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function getCurrentProductNameForPromptHelper() {
    return isEditingFilmingRequirements
      ? filmingProductNameDraft.trim() || filmingRequirements.productName
      : filmingRequirements.productName;
  }

  function buildChatGptPrompt(form: ChatGptPromptHelperForm): string {
    const fieldValue = (value: string) => value.trim() || '请根据常见 TikTok Shop 达人合作需求补充';

    return `请你作为熟悉美国 TikTok Shop 达人合作沟通的内容运营，基于下面的产品信息，生成一版可以直接发给达人的中文「达人拍摄要求」。

【产品信息】
- 产品名称：${fieldValue(getCurrentProductNameForPromptHelper())}
- 产品卖点：${fieldValue(form.sellingPoints)}
- 目标视频数量：${fieldValue(form.videoCount)}
- 单条视频时长要求：${fieldValue(form.durationRequirement)}
- 目标宠物 / 使用场景：${fieldValue(form.targetPetOrScene)}
- 必须展示的画面：${fieldValue(form.mustShowShots)}
- 不希望达人这样拍：${fieldValue(form.avoidShots)}
- 对标视频链接（可选）：${form.referenceLinks.trim() || '无'}

请按以下结构输出，全部使用简体中文：
1. 产品名称
2. 达人拍摄要求（5-8 条，简洁明确，包含目标视频数量、单条视频时长、tag 品牌账号、挂 TikTok Shop 产品链接等要求）
3. 重点拍摄内容（5-8 条，围绕卖点、使用场景、必须展示画面和避免事项）

口吻要求：
- 适合 TikTok Shop 达人的简洁口吻
- 不要太像合同，不要太正式
- 适合美国 TikTok 达人沟通
- 清楚说明需要拍什么、怎么展示、哪些不要拍
- 输出内容方便我复制回工具里的「达人拍摄要求」和「内容重点」编辑框。`;
  }

  function handleGenerateChatGptPrompt() {
    setGeneratedChatGptPrompt(buildChatGptPrompt(promptHelperForm));
    setPromptCopyStatus('');
  }

  async function handleCopyChatGptPrompt() {
    if (!generatedChatGptPrompt) return;

    try {
      await navigator.clipboard.writeText(generatedChatGptPrompt);
      setPromptCopyStatus('已复制提示词。');
    } catch {
      setPromptCopyStatus('复制失败，请手动选中文字复制。');
    }
  }

  function handleAddCreator() {
    const newRow = createBlankCreatorRow(filmingRequirements.productName, requiredVideos);

    setRows((currentRows) => [newRow, ...currentRows]);
    setSelectedCreatorId(newRow.id);
    setMessage(null);
    setError('');
  }

  function handleEditCreator(rowId: string, field: EditableCreatorField, value: string) {
    setRows((currentRows) => currentRows.map((row) => (
      row.id === rowId ? updateCreatorField(row, field, value, requiredVideos) : row
    )));
    setMessage(null);
    setGeneratedMessageCreatorId('');
    setNextFollowUpRecommendation(null);
    setTrackingStatus('');
  }

  function handleDeleteCreator(rowId: string) {
    const confirmed = window.confirm('确定要删除这个达人吗？');
    if (!confirmed) return;

    setRows((currentRows) => deleteCreatorRow(currentRows, rowId));
    setSelectedCreatorId((currentCreatorId) => (currentCreatorId === rowId ? '' : currentCreatorId));
    setMessage(null);
  }

  function handleClearData() {
    const confirmed = window.confirm('确定要清空当前浏览器中保存的达人数据吗？');
    if (!confirmed) return;

    clearSavedCreatorRows();
    setRows([]);
    setFileName('');
    setSelectedCreatorId('');
    setMessage(null);
    setError('');
  }

  function handleExportData() {
    downloadCreatorRowsCsv(rows);
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">TikTok Creator SOP Tool MVP</p>
          <h1>今天应该跟进谁，为什么？</h1>
          <p className="hero-copy">
            上传达人合作表格，系统会根据 SOP 规则分析每个达人的合作状态，自动生成今日跟进清单、优先级、失败风险提醒，并支持按渠道生成达人沟通话术。
          </p>
        </div>
        <div className="brief-card">
          <div className="filming-requirements-heading">
            <h2>达人拍摄要求</h2>
            <div className="filming-requirements-heading-actions">
              {!isEditingFilmingRequirements && (
                <button type="button" className="secondary compact" onClick={handleEditFilmingRequirements}>编辑拍摄要求</button>
              )}
            </div>
          </div>
          {isEditingFilmingRequirements ? (
            <div className="filming-requirements-editor">
              <label>
                产品名称
                <input value={filmingProductNameDraft} onChange={(event) => setFilmingProductNameDraft(event.target.value)} />
              </label>
              <label>
                拍摄要求（每行一条）
                <textarea value={filmingRequirementsDraft} onChange={(event) => setFilmingRequirementsDraft(event.target.value)} rows={5} />
              </label>
              <label>
                内容重点（每行一条）
                <textarea value={keyContentPointsDraft} onChange={(event) => setKeyContentPointsDraft(event.target.value)} rows={6} />
              </label>
              <label>
                对标视频链接（可选，每行一个）
                <textarea
                  value={referenceLinksDraft}
                  onChange={(event) => setReferenceLinksDraft(event.target.value)}
                  rows={4}
                  placeholder="粘贴 TikTok / Shop / 参考视频链接，每行一个。可用于给达人参考拍摄模板或优化方向。"
                />
              </label>
              <div className="filming-requirements-actions">
                <button type="button" onClick={handleSaveFilmingRequirements}>保存拍摄要求</button>
                <button type="button" className="secondary" onClick={handleRestoreDefaultFilmingRequirements}>恢复默认拍摄要求</button>
              </div>
            </div>
          ) : (
            <>
              <strong>{filmingRequirements.productName}</strong>
              <h3>Requirements</h3>
              <ul>
                {filmingRequirements.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>Key content points</h3>
              <ul>
                {filmingRequirements.keyContentPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {(filmingRequirements.referenceLinks ?? []).length > 0 && (
                <section className="reference-links-section">
                  <h3>参考视频链接</h3>
                  <ul>
                    {(filmingRequirements.referenceLinks ?? []).map((link) => (
                      <li key={link}>{link}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <section className="prompt-helper-section" aria-labelledby="prompt-helper-title">
            <div className="prompt-helper-heading">
              <div>
                <h3 id="prompt-helper-title">用 ChatGPT 辅助生成拍摄要求（可选）</h3>
                <p className="muted">这个功能只会生成可复制的提示词，不会自动修改或保存拍摄要求。复制到 ChatGPT 生成结果后，再粘贴到上方「达人拍摄要求」里保存。</p>
              </div>
              {isPromptHelperOpen ? (
                <button type="button" className="secondary compact" onClick={handleClosePromptHelper}>收起辅助生成</button>
              ) : (
                <button type="button" className="secondary compact" onClick={handleOpenPromptHelper}>展开辅助生成</button>
              )}
            </div>

            {isPromptHelperOpen && (
              <div className="ai-generator-panel">
                <p className="ai-cost-note">当前版本不调用 API，不产生额外费用。提示词会使用上方「产品名称」作为产品名称。</p>
                <div className="ai-generator-grid">
                  <label className="wide">
                    产品卖点
                    <textarea value={promptHelperForm.sellingPoints} onChange={(event) => updatePromptHelperField('sellingPoints', event.target.value)} rows={3} />
                  </label>
                  <label>
                    目标视频数量
                    <input value={promptHelperForm.videoCount} onChange={(event) => updatePromptHelperField('videoCount', event.target.value)} />
                  </label>
                  <label>
                    单条视频时长要求
                    <input value={promptHelperForm.durationRequirement} onChange={(event) => updatePromptHelperField('durationRequirement', event.target.value)} placeholder="例如：60 秒以上" />
                  </label>
                  <label className="wide">
                    目标宠物 / 使用场景
                    <input value={promptHelperForm.targetPetOrScene} onChange={(event) => updatePromptHelperField('targetPetOrScene', event.target.value)} />
                  </label>
                  <label className="wide">
                    必须展示的画面
                    <textarea value={promptHelperForm.mustShowShots} onChange={(event) => updatePromptHelperField('mustShowShots', event.target.value)} rows={3} />
                  </label>
                  <label className="wide">
                    不希望达人这样拍
                    <textarea value={promptHelperForm.avoidShots} onChange={(event) => updatePromptHelperField('avoidShots', event.target.value)} rows={3} />
                  </label>
                  <label className="wide">
                    对标视频链接（可选，每行一个）
                    <textarea value={promptHelperForm.referenceLinks} onChange={(event) => updatePromptHelperField('referenceLinks', event.target.value)} rows={2} />
                  </label>
                </div>
                <div className="filming-requirements-actions">
                  <button type="button" onClick={handleGenerateChatGptPrompt}>生成可复制提示词</button>
                </div>
                {generatedChatGptPrompt && (
                  <div className="chatgpt-prompt-output">
                    <p className="ai-status">提示词已生成。请复制到 ChatGPT 使用。</p>
                    <p className="prompt-next-step">下一步：复制提示词到 ChatGPT，生成结果后，把适合的内容粘贴到上方「拍摄要求」和「内容重点」里，再点击保存。</p>
                    <label>
                      ChatGPT 提示词
                      <textarea value={generatedChatGptPrompt} readOnly rows={14} />
                    </label>
                    <div className="filming-requirements-actions">
                      <button type="button" onClick={handleCopyChatGptPrompt}>复制提示词</button>
                    </div>
                    {promptCopyStatus && <p className="ai-status">{promptCopyStatus}</p>}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </header>

      <section className="panel upload-panel">
        <div>
          <h2>1. 上传达人表格</h2>
          <p>支持格式：.csv、.xls、.xlsx。数据已保存在当前浏览器。本版本不支持跨设备同步。</p>
          <p className="muted">不需要登录，不保存数据库；刷新或重新打开本浏览器页面时会自动恢复已保存数据。</p>
        </div>
        <div className="upload-actions">
          <label className="upload-box">
            <input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => handleFile(event.target.files?.[0])} />
            <span>选择 CSV 或 Excel 文件</span>
            {fileName && <small>已加载：{fileName}</small>}
            {!fileName && rows.length > 0 && <small>已恢复当前浏览器保存的数据</small>}
          </label>
          <div className="data-actions">
            <button type="button" onClick={handleExportData} disabled={rows.length === 0}>导出当前表格</button>
            <button type="button" className="secondary danger" onClick={handleClearData} disabled={rows.length === 0}>清空当前数据</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>2. 可编辑数据表</h2>
            <p className="muted">可直接新增、删除或修改表格字段，优先级、今日概览、失败风险和话术候选会即时重新计算并自动保存。</p>
          </div>
          <div className="table-heading-actions">
            <button type="button" onClick={handleAddCreator}>新增达人</button>
            <p className="hint">{videoProgressHint}</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="empty creator-empty-state">当前还没有达人数据。你可以上传表格，或点击「新增达人」手动添加。</p>
        ) : (
          <>
            <div className="table-wrap editable-table-wrap">
              <table className="editable-table">
                <thead>
                  <tr>
                    <th>达人账号</th>
                    <th>主页链接</th>
                    <th>联系渠道</th>
                    <th>产品</th>
                    <th>当前状态</th>
                    <th>物流状态</th>
                    <th>样品到货时间</th>
                    <th>视频进度</th>
                    <th>首条视频发布时间</th>
                    <th>最后联系时间</th>
                    <th>跟进次数</th>
                    <th>备注</th>
                    <th>Tracking status</th>
                    <th>Last message scenario</th>
                    <th>Last message channel</th>
                    <th>Last message sent at</th>
                    <th>Next follow-up date</th>
                    <th>Last creator response</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={trackingRowClass(row)}>
                      <EditableCell label="Creator username" value={row.username} onChange={(value) => handleEditCreator(row.id, 'username', value)} autoFocus={selectedCreatorId === row.id && row.username === ''} />
                      <EditableCell label="Creator profile link" value={row.profileLink} onChange={(value) => handleEditCreator(row.id, 'profileLink', value)} />
                      <EditableCell label="Contact method" value={row.contactMethod} onChange={(value) => handleEditCreator(row.id, 'contactMethod', value)} />
                      <EditableCell label="Product" value={row.product} onChange={(value) => handleEditCreator(row.id, 'product', value)} />
                      <EditableCell label="Current status" value={row.currentStatus} onChange={(value) => handleEditCreator(row.id, 'currentStatus', value)} />
                      <EditableCell label="Sample shipping status" value={row.sampleShippingStatus} onChange={(value) => handleEditCreator(row.id, 'sampleShippingStatus', value)} />
                      <EditableCell label="Sample delivered date" value={row.sampleDeliveredDate} onChange={(value) => handleEditCreator(row.id, 'sampleDeliveredDate', value)} />
                      <EditableCell
                        label="Video progress"
                        value={row.videoProgress}
                        warning={normalizeVideoProgress(row.videoProgress, requiredVideos).warning}
                        onChange={(value) => handleEditCreator(row.id, 'videoProgress', value)}
                      />
                      <EditableCell label="First video posted date" value={row.firstVideoPostedDate} onChange={(value) => handleEditCreator(row.id, 'firstVideoPostedDate', value)} />
                      <EditableCell label="Last contact date" value={row.lastContactDate} onChange={(value) => handleEditCreator(row.id, 'lastContactDate', value)} />
                      <EditableCell label="Last follow-up count" type="number" value={String(row.lastFollowUpCount)} onChange={(value) => handleEditCreator(row.id, 'lastFollowUpCount', value)} />
                      <EditableCell label="Notes" multiline value={row.notes} onChange={(value) => handleEditCreator(row.id, 'notes', value)} />
                      <EditableCell label="Tracking status" value={row.trackingStatus ?? ''} onChange={(value) => handleEditCreator(row.id, 'trackingStatus', value)} />
                      <EditableCell label="Last message scenario" value={row.lastMessageScenario ?? ''} onChange={(value) => handleEditCreator(row.id, 'lastMessageScenario', value)} />
                      <EditableCell label="Last message channel" value={row.lastMessageChannel ?? ''} onChange={(value) => handleEditCreator(row.id, 'lastMessageChannel', value)} />
                      <EditableCell label="Last message sent at" value={row.lastMessageSentAt ?? ''} onChange={(value) => handleEditCreator(row.id, 'lastMessageSentAt', value)} />
                      <EditableCell label="Next follow-up date" value={row.nextFollowUpDate ?? ''} onChange={(value) => handleEditCreator(row.id, 'nextFollowUpDate', value)} />
                      <EditableCell label="Last creator response" multiline value={row.lastCreatorResponse ?? ''} onChange={(value) => handleEditCreator(row.id, 'lastCreatorResponse', value)} />
                      <td>
                        <button type="button" className="secondary danger row-action" onClick={() => handleDeleteCreator(row.id)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">当前共 {rows.length} 行。导出时会保留原始模板列结构。</p>
          </>
        )}
      </section>

      {rows.length > 0 && (
        <>

          <section className="panel">
            <h2>3. 今日跟进概览</h2>
            <div className="summary-grid">
              <SummaryCard label="达人总数" value={summary.totalCreators} />
              <SummaryCard label="今日需跟进" value={summary.needsFollowUp} />
              <SummaryCard label="最高优先级" value={summary.highest} />
              <SummaryCard label="高优先级" value={summary.high} />
              <SummaryCard label="中优先级" value={summary.medium} />
              <SummaryCard label="低优先级" value={summary.low} />
              <SummaryCard label="失败风险提醒" value={summary.failedWarnings} warning />
            </div>
          </section>

          <section className="panel">
            <h2>4. 按优先级排序的今日待办</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>优先级</th>
                    <th>达人</th>
                    <th>产品</th>
                    <th>当前状态</th>
                    <th>触发原因</th>
                    <th>建议动作</th>
                    <th>联系渠道</th>
                    <th>视频进度</th>
                    <th>失败风险</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpTasks.map((task) => (
                    <tr key={task.id}>
                      <td><span className={priorityClass[task.priority]}>{priorityLabel[task.priority]}</span></td>
                      <td>{displayCreatorName(task.username)}</td>
                      <td>{task.product}</td>
                      <td>{task.currentStatus || '—'}</td>
                      <td>{task.triggerReason}</td>
                      <td>{task.suggestedAction}</td>
                      <td>{task.contactMethod || '—'}</td>
                      <td>{task.videoProgress}</td>
                      <td>{task.failedWarnings.length ? '失败风险' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {followUpTasks.length === 0 && <p className="empty">根据当前 MVP 规则，今天没有需要跟进的任务。</p>}
          </section>

          <section className="split">
            <div className="panel">
              <h2>5. 最高优先级达人说明</h2>
              {highestTasks.length === 0 && <p className="empty">今天没有最高优先级达人。</p>}
              {highestTasks.map((task) => (
                <article className="explanation" key={task.id}>
                  <h3>{displayCreatorName(task.username)}</h3>
                  <p>
                    样品已到货 {daysSince(task.sampleDeliveredDate) ?? '未知'} 天，当前视频进度为 {task.videoProgress}。
                    这类任务紧急，因为样品已经到达，但达人还没有发布视频。
                  </p>
                  <p><strong>下一步动作：</strong>{task.suggestedAction}</p>
                </article>
              ))}
            </div>

            <div className="panel warning-panel">
              <h2>6. 合作失败风险提醒</h2>
              {failedCandidates.length === 0 && <p className="empty">当前没有合作失败风险提醒。</p>}
              {failedCandidates.map((task) => (
                <article className="warning" key={task.id}>
                  <h3>{displayCreatorName(task.username)}</h3>
                  <ul>
                    {task.failedWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                  <p>最终处理建议：继续跟进、标记为失败，或稍后复查。系统只提示风险，最终决定由你确认。</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel generator">
            <h2>7. 达人跟进队列</h2>
            <p>按紧急程度排序达人，系统会根据当前合作阶段生成对应话术。</p>
            <div className="generator-controls">
              <div className="creator-selector-panel">
                <label>
                  搜索达人
                  <input
                    aria-label="搜索达人账号 / 产品 / 状态 / 沟通动作"
                    placeholder="搜索达人账号 / 产品 / 状态 / 沟通动作"
                    value={creatorSearchTerm}
                    onChange={(event) => setCreatorSearchTerm(event.target.value)}
                  />
                </label>
                <div className="quick-filters" aria-label="紧急程度筛选">
                  {creatorQuickFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={creatorQuickFilter === filter.key ? 'filter-chip active' : 'filter-chip'}
                      onClick={() => setCreatorQuickFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <label>
                  选择达人
                  <select value={selectedTask?.id ?? ''} onChange={(event) => setSelectedCreatorId(event.target.value)}>
                    {generatorTasks.map((task) => (
                      <option key={task.id} value={task.id}>{creatorOptionLabel(task, requiredVideos)}</option>
                    ))}
                  </select>
                </label>
                {generatorTasks.length === 0 && <p className="empty">{creatorGeneratorEmptyState()}</p>}
              </div>
              <label>
                选择联系渠道
                <select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
                  {CHANNELS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <button onClick={handleGenerateMessage} disabled={!selectedTask}>生成话术</button>
            </div>

            {message && (
              <div className="message-output">
                <div className="queue-message-meta">
                  <p>紧急程度：{message.urgencyLevel}</p>
                  <p>沟通动作：{message.communicationAction}</p>
                  <p>原因：{message.scenarioReason}</p>
                </div>
                <span className="scenario">场景：{scenarioLabel[message.scenario] ?? message.scenario}</span>
                <h3>英文话术</h3>
                <pre>{message.english}</pre>
                <h3>中文解释</h3>
                <p>{message.chineseExplanation}</p>

                <div className="tracking-actions" aria-label="发送后追踪">
                  <h3>发送后追踪</h3>
                  <div className="tracking-button-row">
                    <button type="button" onClick={handleCopyGeneratedMessage}>复制话术</button>
                    <button type="button" onClick={handleMarkMessageSent} disabled={!generatedMessageCreator}>标记为已发送</button>
                    <button type="button" className="secondary" onClick={handleMarkCreatorReplied} disabled={!generatedMessageCreator}>标记达人已回复</button>
                    <button type="button" className="secondary" onClick={handleMarkCompleted} disabled={!generatedMessageCreator}>标记合作完成</button>
                    <button type="button" className="secondary danger" onClick={handleMarkFailed} disabled={!generatedMessageCreator}>标记合作失败</button>
                  </div>
                  {trackingStatus && <p className="tracking-status" role="status">{trackingStatus}</p>}
                </div>

                {nextFollowUpRecommendation && (
                  <section className="next-follow-up">
                    <h3>下一步跟进建议</h3>
                    <p>建议下次跟进时间：{nextFollowUpRecommendation.date}</p>
                    <p>建议动作：{nextFollowUpRecommendation.action}</p>
                  </section>
                )}

                <details className="follow-up-history" open>
                  <summary>跟进记录</summary>
                  {selectedHistory.length === 0 ? (
                    <p className="empty">暂无跟进记录。</p>
                  ) : (
                    <ul>
                      {selectedHistory.slice(-5).reverse().map((entry, index) => (
                        <li key={`${entry.date}-${entry.action}-${index}`}>
                          <strong>{entry.date}</strong> · {entry.action}
                          {entry.channel && <> · {entry.channel}</>}
                          {entry.scenario && <> · {entry.scenario}</>}
                          {entry.note && <p>{entry.note}</p>}
                          {entry.message && <p>{messagePreview(entry.message)}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function EditableCell({
  label,
  value,
  onChange,
  type = 'text',
  warning,
  multiline = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  warning?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <td>
      {multiline ? (
        <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={2} />
      ) : (
        <input aria-label={label} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} />
      )}
      {warning && <p className="cell-warning">{warning}</p>}
    </td>
  );
}

function SummaryCard({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={warning ? 'summary-card warning-count' : 'summary-card'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
