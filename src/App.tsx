import { useEffect, useMemo, useState } from 'react';
import { parseCreatorFile } from './fileParser';
import {
  clearSavedCreatorRows,
  downloadCreatorRowsCsv,
  loadCreatorRows,
  saveCreatorRows,
  updateCreatorField,
  type EditableField,
} from './localData';
import { analyzeCreators, buildSummary, daysSince } from './sopRules';
import { CHANNELS, generateMessage, steamGroomingBrushBrief } from './messageGenerator';
import type { Channel, CreatorRow, GeneratedMessage, Priority } from './types';
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
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [channel, setChannel] = useState<Channel>('TikTok DM');
  const [message, setMessage] = useState<GeneratedMessage | null>(null);

  useEffect(() => {
    if (rows.length > 0) {
      saveCreatorRows(rows);
    }
  }, [rows]);

  const tasks = useMemo(() => analyzeCreators(rows), [rows]);
  const followUpTasks = tasks.filter((task) => task.needsFollowUp);
  const summary = useMemo(() => buildSummary(tasks), [tasks]);
  const highestTasks = tasks.filter((task) => task.priority === 'Highest');
  const failedCandidates = tasks.filter((task) => task.failedWarnings.length > 0);
  const selectedTask = tasks.find((task) => task.id === selectedCreatorId) ?? followUpTasks[0];

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
      setRows([]);
      setFileName('');
    }
  }

  function handleEdit(rowId: string, field: EditableField, value: string) {
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? updateCreatorField(row, field, value) : row)));
    setMessage(null);
  }

  function handleClearData() {
    if (!window.confirm('确定要清空当前数据吗？此操作会删除当前浏览器中保存的达人表格。')) return;
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
    setMessage(generateMessage(selectedTask, channel));
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
          <h2>内置拍摄 Brief</h2>
          <strong>{steamGroomingBrushBrief.productName}</strong>
          <ul>
            {steamGroomingBrushBrief.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </header>

      <section className="panel upload-panel">
        <div>
          <h2>1. 上传达人表格</h2>
          <p>支持格式：.csv、.xls、.xlsx。上传一次后可以直接在页面编辑；数据会自动保存在当前浏览器。</p>
          <p className="save-note">数据已保存在当前浏览器。本版本不支持跨设备同步。</p>
        </div>
        <div className="upload-actions">
          <label className="upload-box">
            <input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => handleFile(event.target.files?.[0])} />
            <span>选择 CSV 或 Excel 文件</span>
            {fileName && <small>已加载：{fileName}</small>}
          </label>
          <div className="data-actions">
            <button type="button" className="secondary-button" onClick={handleExportData} disabled={rows.length === 0}>导出当前表格</button>
            <button type="button" className="danger-button" onClick={handleClearData} disabled={rows.length === 0}>清空当前数据</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {rows.length > 0 && (
        <>
          <section className="panel">
            <h2>2. 数据预览</h2>
            <p className="hint">建议填写 0 of 2、1 of 2、2 of 2，避免 Excel 自动转成日期。</p>
            <div className="table-wrap editable-table-wrap">
              <table className="editable-table">
                <thead>
                  <tr>
                    <th>达人</th>
                    <th>产品</th>
                    <th>当前状态</th>
                    <th>物流状态</th>
                    <th>到货时间</th>
                    <th>视频进度</th>
                    <th>第一条视频发布时间</th>
                    <th>最后联系时间</th>
                    <th>跟进次数</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td><EditableInput label="达人" value={row.username} onChange={(value) => handleEdit(row.id, 'username', value)} /></td>
                      <td><EditableInput label="产品" value={row.product} onChange={(value) => handleEdit(row.id, 'product', value)} /></td>
                      <td><EditableInput label="当前状态" value={row.currentStatus} onChange={(value) => handleEdit(row.id, 'currentStatus', value)} /></td>
                      <td><EditableInput label="物流状态" value={row.sampleShippingStatus} onChange={(value) => handleEdit(row.id, 'sampleShippingStatus', value)} /></td>
                      <td><EditableInput label="到货时间" value={row.sampleDeliveredDate} onChange={(value) => handleEdit(row.id, 'sampleDeliveredDate', value)} /></td>
                      <td>
                        <EditableInput label="视频进度" value={row.videoProgress} onChange={(value) => handleEdit(row.id, 'videoProgress', value)} />
                        {row.videoProgressWarning && <p className="cell-warning">{row.videoProgressWarning}</p>}
                      </td>
                      <td><EditableInput label="第一条视频发布时间" value={row.firstVideoPostedDate} onChange={(value) => handleEdit(row.id, 'firstVideoPostedDate', value)} /></td>
                      <td><EditableInput label="最后联系时间" value={row.lastContactDate} onChange={(value) => handleEdit(row.id, 'lastContactDate', value)} /></td>
                      <td><EditableInput label="跟进次数" type="number" min="0" value={String(row.lastFollowUpCount)} onChange={(value) => handleEdit(row.id, 'lastFollowUpCount', value)} /></td>
                      <td><EditableTextarea label="备注" value={row.notes} onChange={(value) => handleEdit(row.id, 'notes', value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                      <td>{task.username}</td>
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
                  <h3>{task.username}</h3>
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
                  <h3>{task.username}</h3>
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
                    <option key={task.id} value={task.id}>{priorityLabel[task.priority]} — {task.username}</option>
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

function EditableInput({
  label,
  value,
  onChange,
  type = 'text',
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
}) {
  return (
    <input
      className="editable-cell"
      aria-label={label}
      type={type}
      min={min}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function EditableTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <textarea
      className="editable-cell editable-notes"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
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
