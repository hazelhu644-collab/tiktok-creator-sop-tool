import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CREATOR_FILMING_REQUIREMENTS,
  clearSavedCreatorRows,
  clearSavedFilmingRequirements,
  createBlankCreatorRow,
  downloadCreatorRowsCsv,
  loadCreatorRows,
  loadFilmingRequirements,
  saveCreatorRows,
  saveFilmingRequirements,
  updateCreatorField,
  type EditableCreatorField,
} from './creatorData';
import { parseCreatorFile } from './fileParser';
import { analyzeCreators, buildSummary, daysSince } from './sopRules';
import { CHANNELS, generateMessage } from './messageGenerator';
import type { Channel, CreatorFilmingRequirements, CreatorRow, GeneratedMessage, Priority } from './types';
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

const scenarioLabel: Record<string, string> = {
  'Final Follow-up Before Failed Candidate': '合作失败风险前的最后跟进',
  'Sample Delivered Follow-up': '样品到货后催拍',
  'Second Video Reminder': '第二条视频提醒',
  'Second Follow-up': '第二次跟进',
  'Light Follow-up': '轻量跟进',
};

function App() {
  const [rows, setRows] = useState<CreatorRow[]>(() => loadCreatorRows());
  const [filmingRequirements, setFilmingRequirements] = useState<CreatorFilmingRequirements>(() => loadFilmingRequirements());
  const [draftRequirements, setDraftRequirements] = useState<CreatorFilmingRequirements>(() => loadFilmingRequirements());
  const [isEditingRequirements, setIsEditingRequirements] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [channel, setChannel] = useState<Channel>('TikTok DM');
  const [message, setMessage] = useState<GeneratedMessage | null>(null);

  const tasks = useMemo(() => analyzeCreators(rows), [rows]);
  const followUpTasks = tasks.filter((task) => task.needsFollowUp);
  const summary = useMemo(() => buildSummary(tasks), [tasks]);
  const highestTasks = tasks.filter((task) => task.priority === 'Highest');
  const failedCandidates = tasks.filter((task) => task.failedWarnings.length > 0);
  const selectedTask = tasks.find((task) => task.id === selectedCreatorId) ?? followUpTasks[0];

  useEffect(() => {
    saveCreatorRows(rows);
  }, [rows]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setError('');
      setMessage(null);
      const parsedRows = await parseCreatorFile(file);
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

  function handleEditCreator(rowId: string, field: EditableCreatorField, value: string) {
    setRows((currentRows) => currentRows.map((row) => (
      row.id === rowId ? updateCreatorField(row, field, value) : row
    )));
    setMessage(null);
  }

  function handleAddCreator() {
    setRows((currentRows) => [...currentRows, createBlankCreatorRow(filmingRequirements, Date.now() + currentRows.length)]);
    setError('');
    setMessage(null);
  }

  function handleDeleteCreator(rowId: string) {
    const confirmed = window.confirm('确定要删除这个达人吗？');
    if (!confirmed) return;

    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
    if (selectedCreatorId === rowId) setSelectedCreatorId('');
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

  function handleGenerateMessage() {
    if (!selectedTask) return;
    setMessage(generateMessage(selectedTask, channel, filmingRequirements));
  }

  function handleStartEditingRequirements() {
    setDraftRequirements(filmingRequirements);
    setIsEditingRequirements(true);
  }

  function handleSaveRequirements() {
    const saved = saveFilmingRequirements(draftRequirements);
    setFilmingRequirements(saved);
    setDraftRequirements(saved);
    setIsEditingRequirements(false);
    setMessage(null);
  }

  function handleResetRequirements() {
    clearSavedFilmingRequirements();
    setFilmingRequirements(DEFAULT_CREATOR_FILMING_REQUIREMENTS);
    setDraftRequirements(DEFAULT_CREATOR_FILMING_REQUIREMENTS);
    setIsEditingRequirements(false);
    setMessage(null);
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
        <FilmingRequirementsCard
          requirements={filmingRequirements}
          draft={draftRequirements}
          isEditing={isEditingRequirements}
          onDraftChange={setDraftRequirements}
          onEdit={handleStartEditingRequirements}
          onSave={handleSaveRequirements}
          onReset={handleResetRequirements}
        />
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
            <button type="button" onClick={handleAddCreator}>新增达人</button>
            <button type="button" onClick={handleExportData} disabled={rows.length === 0}>导出当前表格</button>
            <button type="button" className="secondary danger" onClick={handleClearData} disabled={rows.length === 0}>清空当前数据</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {rows.length > 0 && (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>2. 可编辑数据表</h2>
                <p className="muted">可直接修改表格字段，优先级、今日概览、失败风险和话术候选会即时重新计算并自动保存。</p>
              </div>
              <p className="hint">视频进度建议填写 0 of 2、1 of 2、2 of 2，避免 Excel 自动转成日期。</p>
            </div>
            <div className="table-wrap editable-table-wrap">
              <table className="editable-table">
                <thead>
                  <tr>
                    <th>Creator username</th>
                    <th>Product</th>
                    <th>Current status</th>
                    <th>Sample shipping status</th>
                    <th>Sample delivered date</th>
                    <th>Video progress</th>
                    <th>First video posted date</th>
                    <th>Last contact date</th>
                    <th>Last follow-up count</th>
                    <th>Notes</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <EditableCell label="Creator username" value={row.username} onChange={(value) => handleEditCreator(row.id, 'username', value)} />
                      <EditableCell label="Product" value={row.product} onChange={(value) => handleEditCreator(row.id, 'product', value)} />
                      <EditableCell label="Current status" value={row.currentStatus} onChange={(value) => handleEditCreator(row.id, 'currentStatus', value)} />
                      <EditableCell label="Sample shipping status" value={row.sampleShippingStatus} onChange={(value) => handleEditCreator(row.id, 'sampleShippingStatus', value)} />
                      <EditableCell label="Sample delivered date" value={row.sampleDeliveredDate} onChange={(value) => handleEditCreator(row.id, 'sampleDeliveredDate', value)} />
                      <EditableCell
                        label="Video progress"
                        value={row.videoProgress}
                        warning={row.videoProgressWarning}
                        onChange={(value) => handleEditCreator(row.id, 'videoProgress', value)}
                      />
                      <EditableCell label="First video posted date" value={row.firstVideoPostedDate} onChange={(value) => handleEditCreator(row.id, 'firstVideoPostedDate', value)} />
                      <EditableCell label="Last contact date" value={row.lastContactDate} onChange={(value) => handleEditCreator(row.id, 'lastContactDate', value)} />
                      <EditableCell label="Last follow-up count" type="number" value={String(row.lastFollowUpCount)} onChange={(value) => handleEditCreator(row.id, 'lastFollowUpCount', value)} />
                      <EditableCell label="Notes" multiline value={row.notes} onChange={(value) => handleEditCreator(row.id, 'notes', value)} />
                      <td><button type="button" className="table-action danger" onClick={() => handleDeleteCreator(row.id)}>删除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">当前共 {rows.length} 行。导出时会保留原始模板列结构。</p>
          </section>

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
                      <td>{task.username || '未命名达人'}</td>
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
                  <h3>{task.username || '未命名达人'}</h3>
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
                  <h3>{task.username || '未命名达人'}</h3>
                  <ul>
                    {task.failedWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                  <p>最终处理建议：继续跟进、标记为失败，或稍后复查。系统只提示风险，最终决定由你确认。</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel generator">
            <h2>7. 生成单个达人话术</h2>
            <p>选择一个达人和一个联系渠道。系统会先生成英文话术，再在下方提供中文解释。</p>
            <div className="generator-controls">
              <label>
                选择达人
                <select value={selectedTask?.id ?? ''} onChange={(event) => setSelectedCreatorId(event.target.value)}>
                  {followUpTasks.map((task) => (
                    <option key={task.id} value={task.id}>{priorityLabel[task.priority]} — {task.username || '未命名达人'}</option>
                  ))}
                </select>
              </label>
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
                <span className="scenario">场景：{scenarioLabel[message.scenario] ?? message.scenario}</span>
                <h3>英文话术</h3>
                <pre>{message.english}</pre>
                <h3>中文解释</h3>
                <p>{message.chineseExplanation}</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function FilmingRequirementsCard({
  requirements,
  draft,
  isEditing,
  onDraftChange,
  onEdit,
  onSave,
  onReset,
}: {
  requirements: CreatorFilmingRequirements;
  draft: CreatorFilmingRequirements;
  isEditing: boolean;
  onDraftChange: (requirements: CreatorFilmingRequirements) => void;
  onEdit: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  if (isEditing) {
    return (
      <div className="requirements-card">
        <h2>达人拍摄要求</h2>
        <label>
          产品名称
          <input value={draft.productName} onChange={(event) => onDraftChange({ ...draft, productName: event.target.value })} />
        </label>
        <label>
          需要视频数量
          <input type="number" min={1} value={draft.videoCount} onChange={(event) => onDraftChange({ ...draft, videoCount: Number(event.target.value) })} />
        </label>
        <label>
          视频时长要求
          <input value={draft.videoDurationRequirement} onChange={(event) => onDraftChange({ ...draft, videoDurationRequirement: event.target.value })} />
        </label>
        <label>
          品牌账号标记要求
          <input value={draft.brandTagRequirement} onChange={(event) => onDraftChange({ ...draft, brandTagRequirement: event.target.value })} />
        </label>
        <label>
          产品链接要求
          <input value={draft.productLinkRequirement} onChange={(event) => onDraftChange({ ...draft, productLinkRequirement: event.target.value })} />
        </label>
        <label>
          重点内容 / 拍摄优先级
          <textarea
            value={draft.keyContentPoints.join('\n')}
            onChange={(event) => onDraftChange({ ...draft, keyContentPoints: event.target.value.split('\n') })}
            rows={5}
          />
        </label>
        <div className="requirements-actions">
          <button type="button" onClick={onSave}>保存拍摄要求</button>
          <button type="button" className="secondary" onClick={onReset}>恢复默认拍摄要求</button>
        </div>
        <p className="muted">达人拍摄要求会影响页面展示和生成达人话术。本版本保存在当前浏览器，不支持跨设备同步。</p>
      </div>
    );
  }

  return (
    <div className="requirements-card">
      <h2>达人拍摄要求</h2>
      <strong>当前产品：{requirements.productName}</strong>
      <ul>
        <li>每位达人 {requirements.videoCount} 条视频</li>
        <li>{requirements.videoDurationRequirement}</li>
        <li>{requirements.brandTagRequirement}</li>
        <li>{requirements.productLinkRequirement}</li>
      </ul>
      <h3>重点内容 / 拍摄优先级</h3>
      <ul>
        {requirements.keyContentPoints.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <p className="muted">达人拍摄要求会影响页面展示和生成达人话术。本版本保存在当前浏览器，不支持跨设备同步。</p>
      <div className="requirements-actions">
        <button type="button" onClick={onEdit}>编辑拍摄要求</button>
        <button type="button" className="secondary" onClick={onReset}>恢复默认拍摄要求</button>
      </div>
    </div>
  );
}

function EditableCell({
  label,
  value,
  onChange,
  type = 'text',
  warning,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  warning?: string;
  multiline?: boolean;
}) {
  return (
    <td>
      {multiline ? (
        <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={2} />
      ) : (
        <input aria-label={label} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
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
