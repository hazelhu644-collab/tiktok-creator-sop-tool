import { useMemo, useState } from 'react';
import { parseCreatorFile } from './fileParser';
import { analyzeCreators, buildSummary, daysSince } from './sopRules';
import { CHANNELS, generateMessage, steamGroomingBrushBrief } from './messageGenerator';
import type { Channel, CreatorRow, GeneratedMessage, Task } from './types';
import './styles.css';

const priorityClass: Record<string, string> = {
  Highest: 'priority highest',
  High: 'priority high',
  Medium: 'priority medium',
  Low: 'priority low',
  None: 'priority none',
};

function App() {
  const [rows, setRows] = useState<CreatorRow[]>([]);
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
        setError('No creator rows were found. Please check the spreadsheet headers and data.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse this file.');
      setRows([]);
      setFileName('');
    }
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
          <h1>Know who to follow up with today — and why.</h1>
          <p className="hero-copy">
            Upload a CSV or Excel creator collaboration sheet. The app analyzes each creator against the MVP SOP rules,
            sorts follow-up tasks by priority, flags failed-candidate warnings, and drafts one channel-specific message at a time.
          </p>
        </div>
        <div className="brief-card">
          <h2>Built-in brief</h2>
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
          <h2>1. Upload spreadsheet</h2>
          <p>Accepted formats: .csv, .xls, .xlsx. Data stays in this browser session; no login or database is used.</p>
        </div>
        <label className="upload-box">
          <input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => handleFile(event.target.files?.[0])} />
          <span>Choose CSV or Excel file</span>
          {fileName && <small>Loaded: {fileName}</small>}
        </label>
        {error && <p className="error">{error}</p>}
      </section>

      {rows.length > 0 && (
        <>
          <section className="panel">
            <h2>2. Data preview</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Shipping</th>
                    <th>Delivered</th>
                    <th>Video progress</th>
                    <th>Last contact</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>{row.profileLink ? <a href={row.profileLink}>{row.username}</a> : row.username}</td>
                      <td>{row.product}</td>
                      <td>{row.currentStatus || '—'}</td>
                      <td>{row.sampleShippingStatus || '—'}</td>
                      <td>{row.sampleDeliveredDate || '—'}</td>
                      <td>{row.videoProgress}</td>
                      <td>{row.lastContactDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 8 && <p className="muted">Showing first 8 of {rows.length} rows.</p>}
          </section>

          <section className="panel">
            <h2>3. Daily task summary</h2>
            <div className="summary-grid">
              <SummaryCard label="Total creators" value={summary.totalCreators} />
              <SummaryCard label="Need follow-up today" value={summary.needsFollowUp} />
              <SummaryCard label="Highest" value={summary.highest} />
              <SummaryCard label="High" value={summary.high} />
              <SummaryCard label="Medium" value={summary.medium} />
              <SummaryCard label="Low" value={summary.low} />
              <SummaryCard label="Failed warnings" value={summary.failedWarnings} warning />
            </div>
          </section>

          <section className="panel">
            <h2>4. Priority-sorted task table</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Creator</th>
                    <th>Product</th>
                    <th>Current status</th>
                    <th>Trigger reason</th>
                    <th>Suggested action</th>
                    <th>Contact method</th>
                    <th>Video progress</th>
                    <th>Failed warning</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpTasks.map((task) => (
                    <tr key={task.id}>
                      <td><span className={priorityClass[task.priority]}>{task.priority}</span></td>
                      <td>{task.username}</td>
                      <td>{task.product}</td>
                      <td>{task.currentStatus || '—'}</td>
                      <td>{task.triggerReason}</td>
                      <td>{task.suggestedAction}</td>
                      <td>{task.contactMethod || '—'}</td>
                      <td>{task.videoProgress}</td>
                      <td>{task.failedWarnings.length ? 'Failed Candidate' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {followUpTasks.length === 0 && <p className="empty">No follow-up task is due today under the MVP rules.</p>}
          </section>

          <section className="split">
            <div className="panel">
              <h2>5. Highest-priority explanations</h2>
              {highestTasks.length === 0 && <p className="empty">No Highest priority creators today.</p>}
              {highestTasks.map((task) => (
                <article className="explanation" key={task.id}>
                  <h3>{task.username}</h3>
                  <p>
                    The sample was delivered {daysSince(task.sampleDeliveredDate) ?? 'unknown'} days ago, and current video progress is {task.videoProgress}.
                    This is urgent because the sample has arrived but no video has been posted yet.
                  </p>
                  <p><strong>Next action:</strong> {task.suggestedAction}</p>
                </article>
              ))}
            </div>

            <div className="panel warning-panel">
              <h2>6. Failed candidate warnings</h2>
              {failedCandidates.length === 0 && <p className="empty">No failed-candidate warnings found.</p>}
              {failedCandidates.map((task) => (
                <article className="warning" key={task.id}>
                  <h3>{task.username}</h3>
                  <ul>
                    {task.failedWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                  <p>Final options: continue following up, mark as failed, or wait and review later.</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel generator">
            <h2>7. Generate one creator message</h2>
            <p>Select one creator and one contact channel. The tool generates the English message first and a Chinese explanation below.</p>
            <div className="generator-controls">
              <label>
                Creator
                <select value={selectedTask?.id ?? ''} onChange={(event) => setSelectedCreatorId(event.target.value)}>
                  {followUpTasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.priority} — {task.username}</option>
                  ))}
                </select>
              </label>
              <label>
                Channel
                <select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
                  {CHANNELS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <button onClick={handleGenerateMessage} disabled={!selectedTask}>Generate message</button>
            </div>

            {message && (
              <div className="message-output">
                <span className="scenario">Scenario: {message.scenario}</span>
                <h3>English message</h3>
                <pre>{message.english}</pre>
                <h3>中文说明</h3>
                <p>{message.chineseExplanation}</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
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
